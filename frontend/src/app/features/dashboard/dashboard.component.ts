import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { RefreshService } from '../../core/services/refresh.service';
import { Transaction, SavingGoalSummary, MonthlySummary } from '../../core/models/finance.model';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, NgxEchartsDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private financeService = inject(FinanceService);
  private refreshService = inject(RefreshService);

  constructor() {
    effect(() => {
      if (this.refreshService.refreshTrigger() > 0) {
        this.fetchDashboardData();
      }
    });
  }

  public netWorth = signal<number>(0);
  public transactions = signal<Transaction[]>([]);
  public savings = signal<SavingGoalSummary[]>([]);
  public isLoading = signal<boolean>(true);
  
  // Analytics Signals
  public cashFlowOptions = signal<EChartsOption>({});
  public categoryOptions = signal<EChartsOption>({});

  ngOnInit() {
    this.fetchDashboardData();
  }

  fetchDashboardData() {
    this.financeService.getPersonalTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data);
        const total = data.reduce((acc, curr) => {
          return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
        }, 0);
        this.netWorth.set(total);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando la vista de dashboard', err);
        this.isLoading.set(false);
      },
    });

    this.financeService.getSavings().subscribe({
      next: (data) => {
        this.savings.set(data);
      },
      error: (err) => {
        console.error('Error cargando los ahorros', err);
      },
    });

    this.financeService.getMonthlySummary().subscribe({
      next: (summary) => this.processAnalyticsData(summary),
      error: (err) => console.error('Error cargando analytics', err)
    });
  }

  processAnalyticsData(data: MonthlySummary[]) {
    const monthMap = new Map<string, { income: number, expense: number }>();
    
    // Obtener mes actual YYYY-MM
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const categoryMap = new Map<string, number>();

    data.forEach(item => {
      // month viene como YYYY-MM-DD, extraemos YYYY-MM
      const yearMonth = item.month.toString().substring(0, 7);

      // Agrupación para Flujo de Caja (Histórico)
      if (!monthMap.has(yearMonth)) {
        monthMap.set(yearMonth, { income: 0, expense: 0 });
      }
      const m = monthMap.get(yearMonth)!;
      if (item.type === 'income') m.income += Number(item.total_amount);
      if (item.type === 'expense') m.expense += Number(item.total_amount);

      // Agrupación de Gastos para el mes actual
      if (yearMonth === currentMonth && item.type === 'expense') {
        const current = categoryMap.get(item.category) || 0;
        categoryMap.set(item.category, current + Number(item.total_amount));
      }
    });

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const incomeData = sortedMonths.map(m => monthMap.get(m)!.income);
    const expenseData = sortedMonths.map(m => monthMap.get(m)!.expense);

    this.cashFlowOptions.set({
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: 'rgba(28, 27, 27, 0.9)', 
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' } 
      },
      legend: { 
        data: ['Ingresos', 'Gastos'], 
        textStyle: { color: '#E5E2E1' },
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: { 
        type: 'category', 
        data: sortedMonths, 
        axisLabel: { color: '#859493' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      yAxis: { 
        type: 'value', 
        axisLabel: { color: '#859493' }, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } 
      },
      series: [
        {
          name: 'Ingresos',
          type: 'line',
          smooth: true,
          data: incomeData,
          itemStyle: { color: '#47EAED' },
          areaStyle: { 
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(71, 234, 237, 0.3)' }, { offset: 1, color: 'rgba(71, 234, 237, 0)' }]
            }
          }
        },
        {
          name: 'Gastos',
          type: 'line',
          smooth: true,
          data: expenseData,
          itemStyle: { color: '#FF5E5E' },
          areaStyle: { 
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(255, 94, 94, 0.3)' }, { offset: 1, color: 'rgba(255, 94, 94, 0)' }]
            }
          }
        }
      ]
    });

    const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    const hasPieData = pieData.length > 0;

    this.categoryOptions.set({
      tooltip: { 
        trigger: 'item', 
        backgroundColor: 'rgba(28, 27, 27, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' } 
      },
      legend: { show: false },
      series: [
        {
          name: 'Gasto por Categoría',
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: '#1C1B1B',
            borderWidth: 2
          },
          label: { show: false },
          data: hasPieData ? pieData : [{ name: 'Sin Gastos', value: 1, itemStyle: { color: 'rgba(255,255,255,0.05)' } }]
        }
      ]
    });
  }
}
