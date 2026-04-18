from datetime import date
from dateutil.relativedelta import relativedelta
from calendar import monthrange
from uuid import UUID
from decimal import Decimal
from supabase import Client
from typing import List, Dict, Any, Optional

from app.schemas.personal import TransactionCreate
from app.schemas.enums import PaymentMethod

class PersonalTransactionService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def calculate_primer_cargo(self, cutoff_day: int, from_date: date) -> date:
        """
        Calcula la fecha del primer cargo (primer corte disponible tras la compra).
        """
        ultimo_dia = monthrange(from_date.year, from_date.month)[1]
        dia_ajustado = min(cutoff_day, ultimo_dia)
        candidato = from_date.replace(day=dia_ajustado)

        # Si ya pasó el corte este mes, el primer cargo es el mes siguiente
        if candidato <= from_date:
            siguiente_mes = from_date + relativedelta(months=1)
            # Volvemos a calcular el último día para el mes siguiente
            ultimo_dia_sig = monthrange(siguiente_mes.year, siguiente_mes.month)[1]
            candidato = siguiente_mes.replace(day=min(cutoff_day, ultimo_dia_sig))

        return candidato

    async def get_or_create_statement(self, credit_card_id: UUID, charge_date: date) -> UUID:
        """
        Busca el estado de cuenta al que pertenece una fecha de cargo, o lo crea si no existe.
        """
        # Buscamos el statement abierto o cuya fecha de corte sea >= a la fecha de cargo
        resp = self.supabase.table("card_statements") \
            .select("id") \
            .eq("credit_card_id", str(credit_card_id)) \
            .gte("cutoff_date", str(charge_date)) \
            .order("cutoff_date", desc=False) \
            .limit(1) \
            .execute()
        
        if resp.data:
            return UUID(resp.data[0]["id"])
        
        # Si no existe, necesitamos info de la tarjeta para crear los parámetros del nuevo corte
        card_resp = self.supabase.table("credit_cards") \
            .select("cutoff_day, payment_due_days") \
            .eq("id", str(credit_card_id)) \
            .execute()
        
        if not card_resp.data:
            raise ValueError(f"Tarjeta de crédito {credit_card_id} no encontrada")
            
        card = card_resp.data[0]
        
        # Calculamos la fecha de corte para este cargo
        cutoff_date = self.calculate_primer_cargo(card["cutoff_day"], charge_date)
        payment_due_date = cutoff_date + relativedelta(days=card["payment_due_days"])
        
        new_stmt = {
            "credit_card_id": str(credit_card_id),
            "cutoff_date": str(cutoff_date),
            "payment_due_date": str(payment_due_date),
            "total_balance": 0.00,
            "minimum_payment": 0.00,
            "status": "open"
        }
        ins_resp = self.supabase.table("card_statements").insert(new_stmt).execute()
        return UUID(ins_resp.data[0]["id"])

    async def create_with_installments(self, data: TransactionCreate, user_id: UUID) -> Dict[str, Any]:
        """
        Lógica maestra para crear compra MSI:
        Genera Transacción Madre, Plan de MSI y N Transacciones Hijas.
        """
        # 1. Crear transacción madre (registro del gasto total)
        madre_data = data.model_dump(mode="json", exclude={'installment_months'})
        madre_data["user_id"] = str(user_id)
        madre_data["is_installment"] = True
        madre_data["installment_months"] = data.installment_months
        madre_data["parent_transaction_id"] = None

        resp_madre = self.supabase.table("personal_transactions").insert(madre_data).execute()
        if not resp_madre.data:
            raise Exception("Error al crear la transacción madre")
        madre = resp_madre.data[0]

        # 2. Cálculos financieros
        total_amount = Decimal(str(data.amount))
        n_months = data.installment_months
        monthly_amount = (total_amount / n_months).quantize(Decimal("0.01"))
        
        # 3. Obtener día de corte de la tarjeta
        card_resp = self.supabase.table("credit_cards").select("cutoff_day").eq("id", str(data.credit_card_id)).execute()
        if not card_resp.data:
             raise Exception("Tarjeta de crédito no válida")
        card = card_resp.data[0]
        
        # 4. Determinar primera fecha de cargo
        first_charge_date = self.calculate_primer_cargo(card["cutoff_day"], data.transaction_date)

        # 5. Crear installment_plan
        plan_data = {
            'original_tx_id': madre['id'],
            'credit_card_id': str(data.credit_card_id),
            'total_amount': float(total_amount),
            'total_months': n_months,
            'monthly_amount': float(monthly_amount),
            'first_charge_date': str(first_charge_date),
            'status': 'active',
        }
        self.supabase.table("installment_plans").insert(plan_data).execute()

        # 6. Generar transacciones hijas (las parcialidades mensuales)
        for i in range(n_months):
            fecha_cargo = first_charge_date + relativedelta(months=i)
            
            # Ajuste del último monto para mitigar errores de redondeo de centavos
            current_amount = monthly_amount
            if i == n_months - 1:
                current_amount = total_amount - (monthly_amount * (n_months - 1))

            # Obtener el ID del corte correspondiente
            statement_id = await self.get_or_create_statement(data.credit_card_id, fecha_cargo)

            hija_data = {
                'user_id': str(user_id),
                'category_id': str(data.category_id),
                'credit_card_id': str(data.credit_card_id),
                'card_statement_id': str(statement_id),
                'amount': float(current_amount),
                'type': 'expense',
                'payment_method': 'credit_card',
                'description': f'{data.description} ({i+1}/{n_months})',
                'transaction_date': str(fecha_cargo),
                'is_installment': False,
                'parent_transaction_id': madre['id'],
            }
            self.supabase.table("personal_transactions").insert(hija_data).execute()

        return madre
