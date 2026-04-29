import { Component, inject, OnInit, signal, effect, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { RecurringService } from '../../core/services/recurring.service';
import { RefreshService } from '../../core/services/refresh.service';
import { Transaction, SavingGoalSummary, MonthlySummary, UpcomingPayment } from '../../core/models/finance.model';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe, DatePipe, NgxEchartsDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private financeService = inject(FinanceService);
  private recurringService = inject(RecurringService);
  private refreshService = inject(RefreshService);

  public netWorth = signal<number>(0);
  public transactions = signal<Transaction[]>([]);
  public savings = signal<SavingGoalSummary[]>([]);
  public upcoming = signal<UpcomingPayment[]>([]);
  public isLoading = signal<boolean>(true);
  
  public activeSavingsCount = computed(() => {
    return this.savings().filter(s => s.status === 'active').length;
  });
  
  public activeSavingsProgress = computed(() => {
    const activeGoals = this.savings().filter(s => s.status === 'active');
    if (activeGoals.length === 0) return 0;
    
    const totalTarget = activeGoals.reduce((acc, curr) => acc + Number(curr.target_amount), 0);
    const totalSaved = activeGoals.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
    
    if (totalTarget === 0) return 0;
    return Math.min(100, Math.max(0, (totalSaved / totalTarget) * 100));
  });
  
  // Stats Signals
  public monthlyIncome = signal<number>(0);
  public monthlyExpense = signal<number>(0);

  // Analytics Signals
  public analyticsFilter = signal<'30D' | '6M' | '1Y'>('6M');
  public cashFlowOptions = signal<EChartsOption>({});
  public categoryOptions = signal<EChartsOption>({});
  
  // Data backing it
  private allTransactions = signal<Transaction[]>([]);
  private monthlySummary = signal<MonthlySummary[]>([]);

  // Computed for Sparkline (mini-bars)
  public sparklineData = computed(() => {
    // Generate some trend data based on recent transactions or summary
    return [30, 45, 40, 60, 55, 80, 70, 90]; // Fallback placeholder logic
  });

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchDashboardData();
      }
    });
    
    // Effect to recalculate analytics when filter changes
    effect(() => {
      this.analyticsFilter();
      this.allTransactions();
      this.monthlySummary();
      this.processAnalyticsData();
    });
  }

  setFilter(filter: '30D' | '6M' | '1Y') {
    this.analyticsFilter.set(filter);
  }

  ngOnInit() {
    this.fetchDashboardData();
  }

  fetchDashboardData() {
    this.isLoading.set(true);
    let loadedCount = 0;
    const totalToLoad = 4;
    const checkLoading = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) this.isLoading.set(false);
    };

    // 1. Transactions & Net Worth
    this.financeService.getPersonalTransactions().subscribe({
      next: (data) => {
        this.allTransactions.set(data);
        this.transactions.set(data.slice(0, 5)); // Only show top 5 in dashboard
        const total = data.reduce((acc, curr) => {
          return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
        }, 0);
        this.netWorth.set(total);
        checkLoading();
      },
      error: (err) => {
        console.error('Error cargando transacciones', err);
        checkLoading();
      },
    });

    // 2. Savings
    this.financeService.getSavings().subscribe({
      next: (data) => {
        this.savings.set(data);
        checkLoading();
      },
      error: (err) => {
        console.error('Error cargando ahorros', err);
        checkLoading();
      },
    });

    // 3. Analytics & Summary
    this.financeService.getMonthlySummary().subscribe({
      next: (summary) => {
        this.monthlySummary.set(summary);
        checkLoading();
      },
      error: (err) => {
        console.error('Error cargando analytics', err);
        checkLoading();
      }
    });

    // 4. Upcoming Recurring
    this.recurringService.getUpcomingPayments().subscribe({
      next: (data) => {
        this.upcoming.set(data.filter(p => p.status === 'pending').slice(0, 3));
        checkLoading();
      },
      error: (err) => {
        console.error('Error cargando próximos pagos', err);
        checkLoading();
      }
    });
  }

  processAnalyticsData() {
    const filter = this.analyticsFilter();
    const allTx = this.allTransactions();
    const summaryData = this.monthlySummary();

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const categoryMap = new Map<string, number>();

    let currentInc = 0;
    let currentExp = 0;

    let incomeData: number[] = [];
    let expenseData: number[] = [];
    let xAxisData: string[] = [];

    // Calculate current month's totals ALWAYS from monthlySummary to keep them consistent
    summaryData.forEach(item => {
      const yearMonth = item.month.toString().substring(0, 7);
      if (yearMonth === currentMonthStr) {
        if (item.type === 'income') currentInc += Number(item.total_amount);
        if (item.type === 'expense') {
          currentExp += Number(item.total_amount);
        }
      }
    });

    this.monthlyIncome.set(currentInc);
    this.monthlyExpense.set(currentExp);

    if (filter === '30D') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0,0,0,0);
      
      const dailyMap = new Map<string, { income: number, expense: number }>();
      
      allTx.forEach(tx => {
        const txDate = new Date(tx.transaction_date + 'T00:00:00'); // Keep local date
        if (txDate >= thirtyDaysAgo && txDate <= today) {
          const dateStr = tx.transaction_date;
          if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { income: 0, expense: 0 });
          const d = dailyMap.get(dateStr)!;
          if (tx.type === 'income') d.income += Number(tx.amount);
          if (tx.type === 'expense') {
            d.expense += Number(tx.amount);
            const catName = tx.categories?.name || 'Uncategorized';
            const current = categoryMap.get(catName) || 0;
            categoryMap.set(catName, current + Number(tx.amount));
          }
        }
      });
      
      const sortedDays = Array.from(dailyMap.keys()).sort();
      xAxisData = sortedDays.map(d => {
        const [, m, day] = d.split('-');
        return `${day}/${m}`;
      });
      incomeData = sortedDays.map(d => dailyMap.get(d)!.income);
      expenseData = sortedDays.map(d => dailyMap.get(d)!.expense);

    } else {
      const monthMap = new Map<string, { income: number, expense: number }>();
      const limitMonths = filter === '6M' ? 6 : 12;
      
      const limitDate = new Date();
      limitDate.setMonth(today.getMonth() - limitMonths + 1);
      const limitMonthStr = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}`;

      summaryData.forEach(item => {
        const yearMonth = item.month.toString().substring(0, 7);
        
        if (yearMonth >= limitMonthStr) {
          if (!monthMap.has(yearMonth)) {
            monthMap.set(yearMonth, { income: 0, expense: 0 });
          }
          const m = monthMap.get(yearMonth)!;
          if (item.type === 'income') m.income += Number(item.total_amount);
          if (item.type === 'expense') {
             m.expense += Number(item.total_amount);
             const current = categoryMap.get(item.category) || 0;
             categoryMap.set(item.category, current + Number(item.total_amount));
          }
        }
      });

      const sortedMonths = Array.from(monthMap.keys()).sort();
      xAxisData = sortedMonths.map(m => this.formatMonth(m));
      incomeData = sortedMonths.map(m => monthMap.get(m)!.income);
      expenseData = sortedMonths.map(m => monthMap.get(m)!.expense);
    }

    this.cashFlowOptions.set({
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: 'rgba(18, 18, 18, 0.95)', 
        borderColor: 'rgba(71, 234, 237, 0.2)',
        textStyle: { color: '#E5E2E1', fontSize: 12, fontFamily: 'Inter' } 
      },
      legend: { 
        data: ['Ingresos', 'Gastos'], 
        textStyle: { color: '#859493', fontSize: 11 },
        top: 0,
        icon: 'circle'
      },
      grid: { left: '2%', right: '2%', bottom: '0%', containLabel: true },
      xAxis: { 
        type: 'category', 
        data: xAxisData, 
        axisLabel: { color: '#4A5555', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: { 
        type: 'value', 
        axisLabel: { show: false }, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } 
      },
      series: [
        {
          name: 'Ingresos',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: incomeData,
          itemStyle: { color: '#47EAED' },
          lineStyle: { width: 3 },
          areaStyle: { 
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(71, 234, 237, 0.15)' }, { offset: 1, color: 'rgba(71, 234, 237, 0)' }]
            }
          }
        },
        {
          name: 'Gastos',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: expenseData,
          itemStyle: { color: '#FF5E5E' },
          lineStyle: { width: 3 },
          areaStyle: { 
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(255, 94, 94, 0.15)' }, { offset: 1, color: 'rgba(255, 94, 94, 0)' }]
            }
          }
        }
      ]
    });

    const pieData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    this.categoryOptions.set({
      tooltip: { 
        trigger: 'item', 
        backgroundColor: 'rgba(18, 18, 18, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#E5E2E1' },
        formatter: '{b}: ${c} ({d}%)'
      },
      series: [
        {
          name: 'Gastos',
          type: 'pie',
          radius: ['55%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 10, borderColor: '#0F1212', borderWidth: 4 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: '14', fontWeight: 'bold', color: '#E5E2E1', formatter: '{b}\n{d}%' } },
          data: pieData.length > 0 ? pieData : [{ name: 'Sin datos', value: 1, itemStyle: { color: '#1C2121' } }]
        }
      ],
      color: ['#47EAED', '#36B6B9', '#258284', '#144F50', '#0D3536']
    });
  }

  private formatMonth(ym: string): string {
    const [y, m] = ym.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]}`;
  }
}
