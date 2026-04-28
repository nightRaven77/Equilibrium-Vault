from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from decimal import Decimal

from app.api.dependencies.auth import get_current_user_supplier
from app.schemas.couples import (
    CoupleCreate,
    CoupleUpdate,
    CoupleResponse,
    CoupleTransactionCreate,
    CoupleTransactionResponse,
    CoupleBalanceResponse
)
from app.schemas.enums import CoupleStatus, SettlementStatus

router = APIRouter(prefix="/couples", tags=["couples"])


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_couple_or_404(supabase: Client, id: UUID) -> dict:
    resp = supabase.table("couples").select("*").eq("id", str(id)).execute()
    if not resp.data:
        raise HTTPException(
            status_code=404, detail="Vínculo de pareja no encontrado")
    return resp.data[0]


def _get_current_uid(supabase: Client) -> str:
    return str(supabase.auth.get_user().user.id)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/search-profile", response_model=dict)
def search_profile(
    email: str,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Busca un perfil de usuario por email para obtener su UUID y nombre.
    Usado en el flujo de creación de vínculo de pareja.
    Nota: Solo devuelve id y full_name (no expone datos sensibles).
    """
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido.")

    current_uid = _get_current_uid(supabase)

    # Buscar en auth.users via profiles (la tabla profiles tiene el email si fue configurado,
    # de lo contrario buscamos en la vista de usuarios de Supabase)
    resp = supabase.table("profiles").select("id, full_name, email").eq("email", email.strip().lower()).execute()

    if not resp.data:
        raise HTTPException(
            status_code=404,
            detail={"code": "PROFILE_NOT_FOUND", "message": "No se encontró ningún usuario con ese email."}
        )

    profile = resp.data[0]

    # No devolver el propio usuario
    if profile["id"] == current_uid:
        raise HTTPException(
            status_code=400,
            detail={"code": "SELF_SEARCH", "message": "No puedes vincularte contigo mismo."}
        )

    return {"id": profile["id"], "full_name": profile.get("full_name") or "Usuario"}


@router.get("/", response_model=List[CoupleResponse])
def get_couples(supabase: Client = Depends(get_current_user_supplier)):
    """
    Obtiene los vínculos de pareja del usuario autenticado,
    enriquecidos con los nombres de ambos usuarios desde profiles.
    """
    couples = supabase.table("couples").select("*").execute().data
    if not couples:
        return []

    # Recopilar todos los UUIDs únicos involucrados
    all_ids = list({c["user1_id"] for c in couples} | {c["user2_id"] for c in couples})
    profiles_resp = supabase.table("profiles").select("id, full_name").in_("id", all_ids).execute()
    names = {p["id"]: p.get("full_name") or "Usuario" for p in profiles_resp.data}

    # Enriquecer cada pareja con los nombres
    for c in couples:
        c["user1_name"] = names.get(c["user1_id"], "Usuario 1")
        c["user2_name"] = names.get(c["user2_id"], "Usuario 2")

    return couples


@router.post("/", response_model=CoupleResponse, status_code=status.HTTP_201_CREATED)
def create_couple(
    couple: CoupleCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea un nuevo vínculo de pareja.
    Valida: no auto-pareja, no vínculo duplicado.
    """
    current_uid = _get_current_uid(supabase)

    # 1. No puedes vincularte contigo mismo
    if str(couple.user2_id) == current_uid:
        raise HTTPException(
            status_code=400,
            detail={"code": "SELF_COUPLE",
                    "message": "No puedes crear un vínculo contigo mismo."}
        )

    # 2. No duplicar vínculos (en cualquier dirección)
    existing = supabase.table("couples").select("id").or_(
        f"and(user1_id.eq.{current_uid},user2_id.eq.{couple.user2_id}),"
        f"and(user1_id.eq.{couple.user2_id},user2_id.eq.{current_uid})"
    ).eq("status", CoupleStatus.active.value).execute()

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail={"code": "DUPLICATE_COUPLE",
                    "message": "Ya existe un vínculo activo con este usuario."}
        )

    data = couple.model_dump(mode="json", exclude_unset=True)
    data["user1_id"] = current_uid

    response = supabase.table("couples").insert(data).execute()
    if not response.data:
        raise HTTPException(
            status_code=400, detail="Error creando el vínculo de pareja")

    return response.data[0]


@router.patch("/{id}", response_model=CoupleResponse)
def update_couple(
    id: UUID,
    couple: CoupleUpdate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Actualiza datos del vínculo (nombre o estado).
    Solo el user1 puede inactivar el vínculo.
    """
    data = couple.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=400, detail="No se enviaron datos para actualizar")

    current = _get_couple_or_404(supabase, id)

    # Solo user1 puede inactivar el vínculo
    if "status" in data and data["status"] == CoupleStatus.inactive:
        current_uid = _get_current_uid(supabase)
        if current["user1_id"] != current_uid:
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN",
                        "message": "Solo el creador del vínculo puede inactivarlo."}
            )

    # No se puede modificar un vínculo ya inactivo
    if current["status"] == CoupleStatus.inactive:
        raise HTTPException(
            status_code=400,
            detail={"code": "COUPLE_INACTIVE",
                    "message": "No puedes modificar un vínculo inactivo."}
        )

    response = supabase.table("couples").update(
        data).eq("id", str(id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=404, detail="Vínculo no encontrado o sin permisos")

    return response.data[0]


@router.get("/{id}/transactions", response_model=List[CoupleTransactionResponse])
def get_couple_transactions(
    id: UUID,
    status: Optional[str] = None,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Lista los gastos compartidos del vínculo.
    Filtro opcional: ?status=pending | settled
    """
    _get_couple_or_404(supabase, id)  # Verifica existencia y propiedad vía RLS

    query = supabase.table("couple_transactions").select("*").eq(
        "couple_id", str(id)
    ).order("transaction_date", desc=True)

    if status in ("pending", "settled"):
        query = query.eq("status", status)

    response = query.execute()
    return response.data


@router.post("/{id}/transactions", response_model=CoupleTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_couple_transaction(
    id: UUID,
    transaction: CoupleTransactionCreate,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Crea un gasto compartido. La suma de porcentajes es validada en el schema.
    Valida: vínculo activo, paid_by pertenece al vínculo.
    """
    current = _get_couple_or_404(supabase, id)

    # 1. El vínculo debe estar activo
    if current["status"] == CoupleStatus.inactive:
        raise HTTPException(
            status_code=400,
            detail={"code": "COUPLE_INACTIVE",
                    "message": "No puedes registrar gastos en un vínculo inactivo."}
        )

    # 2. paid_by_user_id debe ser miembro del vínculo
    members = {current["user1_id"], current["user2_id"]}
    if str(transaction.paid_by_user_id) not in members:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PAYER",
                    "message": "El pagador debe ser miembro del vínculo."}
        )

    # 3. Si usa tarjeta de crédito, verificar que pertenece al pagador
    if transaction.credit_card_id:
        card_resp = supabase.table("credit_cards").select("id, user_id").eq(
            "id", str(transaction.credit_card_id)
        ).execute()
        if not card_resp.data or card_resp.data[0]["user_id"] != str(transaction.paid_by_user_id):
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_CARD",
                        "message": "La tarjeta de crédito no pertenece al pagador."}
            )

    data = transaction.model_dump(mode="json", exclude_unset=True)
    data["couple_id"] = str(id)

    response = supabase.table("couple_transactions").insert(data).execute()
    if not response.data:
        raise HTTPException(
            status_code=400, detail="Error registrando el gasto compartido")

    return response.data[0]


@router.patch("/{id}/transactions/{tx_id}/settle", response_model=CoupleTransactionResponse)
def settle_transaction(
    id: UUID,
    tx_id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Marca un gasto compartido como liquidado.
    Valida: transacción existe, pertenece al vínculo, no está ya liquidada.
    """
    # 1. Verificar que el vínculo existe
    _get_couple_or_404(supabase, id)

    # 2. Buscar la transacción y verificar estado actual
    tx_resp = supabase.table("couple_transactions").select("id, status, couple_id").eq(
        "id", str(tx_id)
    ).eq("couple_id", str(id)).execute()

    if not tx_resp.data:
        raise HTTPException(
            status_code=404,
            detail="Transacción no encontrada en este vínculo"
        )

    tx = tx_resp.data[0]

    # 3. No re-liquidar lo que ya está liquidado
    if tx["status"] == SettlementStatus.settled:
        raise HTTPException(
            status_code=400,
            detail={"code": "ALREADY_SETTLED",
                    "message": "Esta transacción ya está liquidada."}
        )

    response = supabase.table("couple_transactions").update({
        "status": "settled"
    }).eq("id", str(tx_id)).eq("couple_id", str(id)).execute()

    if not response.data:
        raise HTTPException(
            status_code=404, detail="Transacción no encontrada o inmodificable")

    return response.data[0]


@router.patch("/{id}/transactions/settle-all", status_code=status.HTTP_200_OK)
def settle_all_transactions(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Liquida todas las transacciones pendientes del vínculo de un solo golpe.
    """
    current = _get_couple_or_404(supabase, id)

    if current["status"] == CoupleStatus.inactive:
        raise HTTPException(
            status_code=400,
            detail={"code": "COUPLE_INACTIVE",
                    "message": "El vínculo está inactivo."}
        )

    response = supabase.table("couple_transactions").update({
        "status": "settled"
    }).eq("couple_id", str(id)).eq("status", "pending").execute()

    count = len(response.data) if response.data else 0
    return {"settled_count": count, "message": f"{count} transacción(es) liquidada(s)."}


@router.get("/{id}/balance", response_model=CoupleBalanceResponse)
def get_couple_balance(
    id: UUID,
    supabase: Client = Depends(get_current_user_supplier)
):
    """
    Obtiene el balance actual a través de la vista v_couple_balance.
    """
    couple_resp = supabase.table("couples").select(
        "user1_id, user2_id").eq("id", str(id)).execute()
    if not couple_resp.data:
        raise HTTPException(status_code=404, detail="Vínculo no encontrado")

    couple = couple_resp.data[0]
    user1_id = couple["user1_id"]
    user2_id = couple["user2_id"]
    current_uid = _get_current_uid(supabase)

    # Consultar perfiles para nombres humanizados
    profiles_resp = supabase.table("profiles").select(
        "id, full_name").in_("id", [user1_id, user2_id]).execute()
    names = {p["id"]: p["full_name"] for p in profiles_resp.data}

    user1_name = names.get(user1_id, "Tú" if user1_id ==
                           current_uid else "Pareja")
    user2_name = names.get(user2_id, "Tú" if user2_id ==
                           current_uid else "Pareja")

    balance_resp = supabase.table("v_couple_balance").select(
        "*").eq("couple_id", str(id)).execute()

    if not balance_resp.data:
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)

    row = balance_resp.data[0]
    raw_amount = row.get("user2_owes_user1")

    if raw_amount is None:
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)

    amount = Decimal(str(raw_amount))

    if amount == Decimal("0.00"):
        return CoupleBalanceResponse(amount=Decimal("0.00"), is_settled=True)

    elif amount > 0:
        return CoupleBalanceResponse(
            debtor_id=UUID(user2_id),
            creditor_id=UUID(user1_id),
            debtor_name=user2_name,
            creditor_name=user1_name,
            amount=amount,
            is_settled=False
        )
    else:
        return CoupleBalanceResponse(
            debtor_id=UUID(user1_id),
            creditor_id=UUID(user2_id),
            debtor_name=user1_name,
            creditor_name=user2_name,
            amount=abs(amount),
            is_settled=False
        )
