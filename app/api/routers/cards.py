import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.cards import (
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardResponse,
    CardStatementResponse,
    StatementPayRequest,
    StatementPayResponse,
)

router = APIRouter(prefix="/cards", tags=["cards"])


def calculate_next_cutoff_python(cutoff_day: int, from_date: date) -> date:
    """Fallback si RLS o el RPC falla."""
    target_month = from_date.month
    target_year = from_date.year
    if from_date.day > cutoff_day:
        target_month += 1
        if target_month > 12:
            target_month = 1
            target_year += 1
    _, last_day_of_month = calendar.monthrange(target_year, target_month)
    actual_day = min(cutoff_day, last_day_of_month)
    return date(target_year, target_month, actual_day)


def _calculate_card_balance(supabase: Client, card_id: str) -> Decimal:
    """Calcula el saldo vivo real de la tarjeta sumando gastos en cortes no pagados o sin corte."""
    stmts_resp = supabase.table("card_statements").select("id").eq("credit_card_id", card_id).neq("status", "paid").execute()
    unpaid_stmt_ids = [s["id"] for s in (stmts_resp.data or [])]

    balance = Decimal("0.00")
    if unpaid_stmt_ids:
        tx_resp = supabase.table("personal_transactions").select("amount") \
            .eq("credit_card_id", card_id) \
            .eq("type", "expense") \
            .in_("card_statement_id", unpaid_stmt_ids) \
            .execute()
        if tx_resp.data:
            balance += sum([Decimal(str(tx.get("amount", 0))) for tx in tx_resp.data])

    # Transacciones asignadas a la tarjeta sin corte (excluyendo hijas de MSI para no duplicar)
    unassigned_tx = supabase.table("personal_transactions").select("amount") \
        .eq("credit_card_id", card_id) \
        .eq("type", "expense") \
        .is_("card_statement_id", "null") \
        .is_("parent_transaction_id", "null") \
        .execute()
    if unassigned_tx.data:
        balance += sum([Decimal(str(tx.get("amount", 0))) for tx in unassigned_tx.data])

    return balance


@router.get("/", response_model=List[CreditCardResponse])
def get_credit_cards(supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene las tarjetas de crédito activas del usuario autenticado con su saldo vivo."""
    response = supabase.table("credit_cards").select(
        "*").eq("is_active", True).execute()
    cards = response.data or []
    for card in cards:
        card["current_balance"] = _calculate_card_balance(supabase, card["id"])
    return cards


@router.post("/", response_model=CreditCardResponse, status_code=status.HTTP_201_CREATED)
def create_credit_card(
    card: CreditCardCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea una tarjeta de crédito y su primer estado de cuenta (statement) abierto.
    """
    user = supabase.auth.get_user().user
    card_data = card.model_dump(mode="json", exclude_unset=True)
    card_data["user_id"] = str(user.id)

    # 0. Validar duplicados (misma tarjeta activa)
    existing = supabase.table("credit_cards").select("id").eq("user_id", str(user.id)).eq("bank_name", card.bank_name).eq("last_four", card.last_four).eq("is_active", True).execute()
    if existing.data:
        raise HTTPException(
            status_code=400, 
            detail={"code": "DUPLICATE_CARD", "message": f"Ya tienes una tarjeta activa de {card.bank_name} terminada en {card.last_four}."}
        )

    # 1. Insertamos la tarjeta
    card_res = supabase.table("credit_cards").insert(card_data).execute()
    if not card_res.data:
        raise HTTPException(
            status_code=400, detail="No se pudo crear la tarjeta")
    created_card = card_res.data[0]

    try:
        # 2. Generar el estado de cuenta
        today = date.today()
        cutoff_date_str = None
        try:
            # Intentamos con RPC
            rpc_res = supabase.rpc(
                "next_cutoff_date",
                {"day": card.cutoff_day, "from_date": str(today)}
            ).execute()
            if rpc_res.data:
                cutoff_date_str = rpc_res.data
        except Exception:
            pass

        if not cutoff_date_str:
            # Fallback de Python
            cutoff_date = calculate_next_cutoff_python(card.cutoff_day, today)
        else:
            # Si vino del RPC es string, lo pasamos a date para sumar días
            cutoff_date = date.fromisoformat(str(cutoff_date_str).split("T")[0])

        payment_due_date = cutoff_date + timedelta(days=card.payment_due_days)

        statement_data = {
            "credit_card_id": created_card["id"],
            "cutoff_date": str(cutoff_date),
            "payment_due_date": str(payment_due_date),
            "total_balance": 0.00,
            "minimum_payment": 0.00,
            "status": "open"
        }

        # 3. Insertar statement
        supabase.table("card_statements").insert(statement_data).execute()
    
    except Exception as e:
        # Rollback manual: Si falla la creación del estado de cuenta inicial, borramos la tarjeta para evitar huérfanos
        supabase.table("credit_cards").delete().eq("id", created_card["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Error al generar el estado de cuenta inicial: {str(e)}")

    return created_card


@router.get("/{id}", response_model=CreditCardResponse)
def get_credit_card(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    response = supabase.table("credit_cards").select(
        "*").eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    card = response.data[0]
    card["current_balance"] = _calculate_card_balance(supabase, str(id))
    return card


@router.patch("/{id}", response_model=CreditCardResponse)
def update_credit_card(
    id: UUID,
    card: CreditCardUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    update_data = card.model_dump(mode="json", exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=400, detail="No hay datos para actualizar")

    # Si se actualiza el nombre del banco o la terminación, validar que no haya duplicados
    if "bank_name" in update_data or "last_four" in update_data:
        current_card_resp = supabase.table("credit_cards").select("bank_name, last_four, user_id").eq("id", str(id)).execute()
        if not current_card_resp.data:
            raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
        current_card = current_card_resp.data[0]
        
        new_bank_name = update_data.get("bank_name", current_card["bank_name"])
        new_last_four = update_data.get("last_four", current_card["last_four"])
        
        if new_bank_name != current_card["bank_name"] or new_last_four != current_card["last_four"]:
            existing = supabase.table("credit_cards").select("id").eq("user_id", current_card["user_id"]).eq("bank_name", new_bank_name).eq("last_four", new_last_four).eq("is_active", True).execute()
            if existing.data:
                raise HTTPException(
                    status_code=400, 
                    detail={"code": "DUPLICATE_CARD", "message": f"Ya tienes otra tarjeta activa de {new_bank_name} terminada en {new_last_four}."}
                )

    # Si se actualiza el límite de crédito, validar que no sea menor a la deuda actual (transacciones en statements no pagados)
    if "credit_limit" in update_data:
        new_limit = float(update_data["credit_limit"])
        statements_resp = supabase.table("card_statements").select("id").eq("credit_card_id", str(id)).neq("status", "paid").execute()
        unpaid_stmt_ids = [s["id"] for s in statements_resp.data]
        
        total_debt = 0.0
        if unpaid_stmt_ids:
            tx_resp = supabase.table("personal_transactions").select("amount").eq("type", "expense").in_("card_statement_id", unpaid_stmt_ids).execute()
            total_debt = sum([float(tx.get("amount", 0)) for tx in tx_resp.data])
            
        if new_limit < total_debt:
            raise HTTPException(
                status_code=400,
                detail={"code": "LIMIT_TOO_LOW", "message": f"El nuevo límite (${new_limit:,.2f}) no puede ser menor a tu deuda actual (${total_debt:,.2f})."}
            )

    response = supabase.table("credit_cards").update(
        update_data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return response.data[0]


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_card(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Aplica soft-delete (is_active = FALSE) a la tarjeta previa validación"""

    # 0. Validar existencia
    card_resp = supabase.table("credit_cards").select(
        "id").eq("id", str(id)).execute()
    if not card_resp.data:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    # 1. Validar que no haya saldo pendiente por pagar (utilizando el cálculo real de deuda viva)
    total_debt = _calculate_card_balance(supabase, str(id))
    if total_debt > Decimal("0.00"):
        raise HTTPException(
            status_code=400,
            detail={"code": "HAS_DEBT",
                    "message": f"No puedes eliminar esta tarjeta porque tiene un saldo pendiente de ${total_debt:,.2f}."}
        )

    # 2. Validar que no haya MSI activos
    installments_resp = supabase.table("installment_plans").select(
        "id").eq("credit_card_id", str(id)).eq("status", "active").execute()
    if installments_resp.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "HAS_INSTALLMENTS",
                    "message": "No puedes eliminar esta tarjeta porque tiene Meses Sin Intereses (MSI) activos."}
        )

    # 3. Validar pagos recurrentes
    recurring_resp = supabase.table("recurring_payments").select("id").eq(
        "credit_card_id", str(id)).eq("is_active", True).execute()
    if recurring_resp.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "HAS_RECURRING",
                    "message": "Esta tarjeta está vinculada a pagos recurrentes activos."}
        )

    supabase.table("credit_cards").update(
        {"is_active": False}).eq("id", str(id)).execute()
    return None


@router.get("/{id}/statements", response_model=List[CardStatementResponse])
def get_card_statements(id: UUID, supabase: Client = Depends(get_current_user_supplier)):
    """Obtiene los estados de cuenta (historial de cortes) de la tarjeta."""
    response = supabase.table("card_statements").select(
        "*").eq("credit_card_id", str(id)).order("cutoff_date", desc=True).execute()
    return response.data


@router.post("/{id}/statements/{statement_id}/pay", response_model=StatementPayResponse)
def pay_card_statement(
    id: UUID,
    statement_id: UUID,
    payment_data: StatementPayRequest,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Registra el pago de un estado de cuenta (corte de tarjeta).
    - Marca el corte como pagado o amortiza saldo parcial.
    - Opcionalmente genera la transacción personal de egreso correspondiente.
    """
    user = supabase.auth.get_user().user

    # 1. Validar existencia de la tarjeta
    card_resp = supabase.table("credit_cards").select("*").eq("id", str(id)).execute()
    if not card_resp.data:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    card = card_resp.data[0]

    # 2. Validar que el corte existe y pertenece a la tarjeta
    stmt_resp = supabase.table("card_statements").select("*").eq("id", str(statement_id)).eq("credit_card_id", str(id)).execute()
    if not stmt_resp.data:
        raise HTTPException(status_code=404, detail="Estado de cuenta no encontrado para esta tarjeta")
    statement = stmt_resp.data[0]

    if statement.get("status") == "paid":
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_PAID", "message": "Este estado de cuenta ya está liquidado."}
        )

    # 3. Calcular deuda viva del corte
    tx_resp = supabase.table("personal_transactions").select("amount") \
        .eq("card_statement_id", str(statement_id)) \
        .eq("type", "expense") \
        .execute()
    statement_debt = sum([Decimal(str(tx.get("amount", 0))) for tx in (tx_resp.data or [])])

    if payment_data.amount is None or payment_data.amount >= statement_debt:
        pay_amount = statement_debt if statement_debt > Decimal("0.00") else (payment_data.amount or Decimal("0.00"))
        new_status = "paid"
        new_balance = Decimal("0.00")
    else:
        pay_amount = payment_data.amount
        new_status = "open"
        new_balance = statement_debt - pay_amount

    # 4. Actualizar el estado de cuenta
    upd_resp = supabase.table("card_statements").update({
        "status": new_status,
        "total_balance": float(new_balance),
    }).eq("id", str(statement_id)).execute()

    if not upd_resp.data:
        raise HTTPException(status_code=500, detail="Error al actualizar el estado de cuenta")
    updated_stmt = upd_resp.data[0]

    # 5. Registrar transacción personal de egreso si se solicitó
    created_tx_id = None
    if payment_data.register_transaction and pay_amount > Decimal("0.00"):
        category_id = payment_data.category_id
        if not category_id:
            cat_resp = supabase.table("categories").select("id").eq("type", "expense").execute()
            if cat_resp.data:
                category_id = UUID(cat_resp.data[0]["id"])

        if category_id:
            tx_payload = {
                "user_id": str(user.id),
                "category_id": str(category_id),
                "credit_card_id": None,
                "card_statement_id": None,
                "amount": float(pay_amount),
                "type": "expense",
                "payment_method": payment_data.payment_method.value,
                "description": f"Pago Tarjeta {card['bank_name']} (****{card['last_four']})",
                "notes": payment_data.notes or f"Pago de corte con fecha {statement['cutoff_date']}",
                "transaction_date": str(payment_data.payment_date),
            }
            tx_create_resp = supabase.table("personal_transactions").insert(tx_payload).execute()
            if tx_create_resp.data:
                created_tx_id = UUID(tx_create_resp.data[0]["id"])

    return StatementPayResponse(
        statement=updated_stmt,
        payment_amount=pay_amount,
        transaction_id=created_tx_id,
        message=f"Estado de cuenta {'liquidado' if new_status == 'paid' else 'actualizado'} exitosamente."
    )
