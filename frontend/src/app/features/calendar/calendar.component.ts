import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RecurringService } from '../../core/services/recurring.service';
import { forkJoin } from 'rxjs';
import { Category, Transaction, UpcomingPayment } from '../../core/models/finance.model';

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: 'recurring' | 'installment';
  status: string;
  categoryName: string;
  icon: string;
  color: string;
}

export interface MonthGroup {
  monthYear: string;
  monthName: string;
  totalAmount: number;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  private financeService = inject(FinanceService);
  private recurringService = inject(RecurringService);

  public isLoading = signal<boolean>(true);
  public monthGroups = signal<MonthGroup[]>([]);
  public totalFutureCommitments = signal<number>(0);

  // Mapeo básico de logos para suscripciones si se desea
  private readonly brandLogos: Record<string, string> = {
    netflix: 'netflix',
    spotify: 'spotify',
    apple: 'apple',
    amazon: 'amazon',
    youtube: 'youtube',
    disney: 'disney',
    hbo: 'hbo',
    xbox: 'xbox',
    playstation: 'playstation',
    nintendo: 'nintendo',
    crunchyroll: 'crunchyroll',
    claude: 'claude',
    copilot: 'githubcopilot',
    google: 'googlegemini',
  };

  ngOnInit(): void {
    this.loadCalendarData();
  }

  loadCalendarData(): void {
    this.isLoading.set(true);

    forkJoin({
      transactions: this.financeService.getPersonalTransactions(),
      upcoming: this.recurringService.getUpcomingPayments(),
      categories: this.financeService.getCategories('expense'),
    }).subscribe({
      next: ({ transactions, upcoming, categories }) => {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Filtrar transacciones MSI futuras
        const futureInstallments = transactions.filter(
          (t: Transaction) =>
            t.transaction_date >= todayStr &&
            t.parent_transaction_id != null &&
            t.is_installment === false,
        );

        // 2. Crear mapa de categorías
        const catMap = new Map<string, Category>();
        categories.forEach((c: Category) => catMap.set(c.id, c));

        // 3. Mapear a CalendarEvent
        const events: CalendarEvent[] = [];

        futureInstallments.forEach((t: Transaction) => {
          const cat = catMap.get(t.category_id);
          events.push({
            id: t.id,
            date: t.transaction_date,
            title: t.description,
            amount: Number(t.amount),
            type: 'installment',
            status: 'pending', // Los MSI futuros siempre están pendientes hasta que se pagan en el statement
            categoryName: cat?.name || 'Gasto',
            icon: cat?.icon || 'credit_card',
            color: cat?.color || '#E5E2E1',
          });
        });

        // Solo las ocurrencias desde hoy en adelante o pendientes
        upcoming.forEach((u: UpcomingPayment) => {
          if (u.status !== 'paid') {
            events.push({
              id: u.occurrence_id,
              date: u.scheduled_date,
              title: u.plan_name,
              amount: Number(u.amount),
              type: 'recurring',
              status: u.status,
              categoryName: u.category_name || 'Suscripción',
              icon: u.category_icon || 'event_repeat',
              color: u.category_color || '#47EAED', // Primary color fallback
            });
          }
        });

        // 4. Ordenar ascendente
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 5. Agrupar por Mes-Año
        const groupsMap = new Map<string, MonthGroup>();
        let grandTotal = 0;

        events.forEach((ev) => {
          grandTotal += ev.amount;
          const d = new Date(ev.date + 'T12:00:00'); // Evitar timezone issues
          const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

          if (!groupsMap.has(monthYear)) {
            const monthName = new Intl.DateTimeFormat('es-MX', {
              month: 'long',
              year: 'numeric',
            }).format(d);
            groupsMap.set(monthYear, {
              monthYear,
              monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
              totalAmount: 0,
              events: [],
            });
          }
          const group = groupsMap.get(monthYear)!;
          group.events.push(ev);
          group.totalAmount += ev.amount;
        });

        // Convertir a array
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) =>
          a.monthYear.localeCompare(b.monthYear),
        );

        this.monthGroups.set(sortedGroups);
        this.totalFutureCommitments.set(grandTotal);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading calendar data', err);
        this.isLoading.set(false);
      },
    });
  }

  getBrandLogo(name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const key in this.brandLogos) {
      if (lowerName.includes(key)) {
        return key;
      }
    }
    return null;
  }
}
