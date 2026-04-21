import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RecurringService } from '../../core/services/recurring.service';
import { RefreshService } from '../../core/services/refresh.service';
import { ModalService } from '../../core/services/modal.service';
import { RecurringPayment, UpcomingPayment } from '../../core/models/finance.model';
import { RecurringPlanModalComponent } from './recurring-plan-modal/recurring-plan-modal.component';
import { OccurrencePayModalComponent } from './occurrence-pay-modal/occurrence-pay-modal.component';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    RecurringPlanModalComponent,
    OccurrencePayModalComponent,
  ],
  templateUrl: './recurring.component.html',
})
export class RecurringComponent implements OnInit {
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);
  public modalService = inject(ModalService);

  public activePlans = signal<RecurringPayment[]>([]);
  public upcomingPayments = signal<UpcomingPayment[]>([]);
  public isLoading = signal<boolean>(true);

  // Logo mapping dictionary based on user request
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

  constructor() {
    effect(() => {
      // Reload when transaction or changes happen
      if (this.refreshService.refreshTrigger() > 0) {
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    let loaded = 0;
    const checkDone = () => {
      loaded++;
      if (loaded === 2) this.isLoading.set(false);
    };

    this.recurringService.getRecurringPayments().subscribe({
      next: (plans) => {
        this.activePlans.set(plans);
        checkDone();
      },
      error: (err) => {
        console.error('Error fetching recurring plans', err);
        checkDone();
      },
    });

    this.recurringService.getUpcomingPayments().subscribe({
      next: (upcoming) => {
        this.upcomingPayments.set(upcoming);
        checkDone();
      },
      error: (err) => {
        console.error('Error fetching upcoming payments', err);
        checkDone();
      },
    });
  }

  openAddPlanModal(): void {
    this.modalService.openRecurringPlanModal();
  }

  editPlan(id: string): void {
    this.modalService.openRecurringPlanModal(id);
  }

  payOccurrence(occurrenceId: string): void {
    this.modalService.openOccurrencePayModal(occurrenceId);
  }

  getBrandLogo(name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const key in this.brandLogos) {
      if (lowerName.includes(key)) {
        console.log(lowerName.includes(key));
        // We'll map this to an image source or css class.
        // Assuming we might have assets or we can just use simple external logos for now if we don't have local assets.
        // For premium feel, since it's a dynamic app, we can use simple known URLs or SVG icons.
        // Let's return the key so the template can decide.
        return key;
      }
    }
    return null;
  }
}
