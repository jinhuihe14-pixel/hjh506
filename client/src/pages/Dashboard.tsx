import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker } from 'antd';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import { inventoryApi, reportsApi } from '../api/types';

const { RangePicker } = DatePicker;

function Dashboard() {
  const [overview, setOverview] = useState<any>({});
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    const [ov, trend, cat, summary] = await Promise.all([
      inventoryApi.overview(),
      reportsApi.salesTrend(6),
      reportsApi.monthlyCategories(month),
      reportsApi.monthlySummary(month)
    ]);
    setOverview(ov);
    setSalesTrend(trend);
    setCategoryStats(cat);
    setMonthlySummary(summary);
  };

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '销售数量'] },
    xAxis: {
      type: 'category',
      data: salesTrend.map(item => item.month)
    },
    yAxis: [
      { type: 'value', name: '销售额(元)' },
      { type: 'value', name: '数量' }
    ],
    series: [
      {
        name: '销售额',
        type: 'bar',
        data: salesTrend.map(item => item.sales_amount),
        itemStyle: { color: '#1677ff' }
      },
      {
        name: '销售数量',
        type: 'line',
        yAxisIndex: 1,
        data: salesTrend.map(item => item.sales_quantity),
        itemStyle: { color: '#52c41a' },
        smooth: true
      }
    ]
  };

  const categoryOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: categoryStats.slice(0, 8).map(item => ({
          name: item.category_name,
          value: item.sales_amount
        })),
        label: { show: false }
      }
    ]
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DatePicker.MonthPicker 
          value={dayjs(month)} 
          onChange={(date) => date && setMonth(date.format('YYYY-MM'))}
          style={{ width: 150 }}
        />
        <span style={{ marginLeft: 16, color: '#666' }}>
          {month} 月度数据
        </span>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="商品种类" 
              value={overview.totalProducts || 0} 
              suffix="种"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="库存总量" 
              value={overview.totalStock || 0} 
              suffix="件"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="库存金额" 
              value={overview.totalValue || 0} 
              suffix="元"
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="低库存预警" 
              value={overview.lowStockCount || 0} 
              suffix="种"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {monthlySummary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card title="本月销售总额">
              <Statistic 
                value={monthlySummary.sales?.sales_amount || 0} 
                suffix="元" 
                precision={2}
                valueStyle={{ color: '#1677ff', fontSize: 24 }}
              />
              <div style={{ marginTop: 8, color: '#666' }}>
                订单数: {monthlySummary.sales?.order_count || 0} 单
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card title="本月毛利">
              <Statistic 
                value={monthlySummary.sales?.gross_profit || 0} 
                suffix="元" 
                precision={2}
                valueStyle={{ color: '#52c41a', fontSize: 24 }}
              />
              <div style={{ marginTop: 8, color: '#666' }}>
                毛利率: {monthlySummary.sales?.gross_margin || 0}%
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card title="本月采购金额">
              <Statistic 
                value={monthlySummary.purchase?.purchase_amount || 0} 
                suffix="元" 
                precision={2}
                valueStyle={{ color: '#fa8c16', fontSize: 24 }}
              />
              <div style={{ marginTop: 8, color: '#666' }}>
                采购单: {monthlySummary.purchase?.order_count || 0} 单
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card title="会员总数">
              <Statistic 
                value={monthlySummary.members?.total || 0} 
                suffix="人" 
                valueStyle={{ color: '#722ed1', fontSize: 24 }}
              />
              <div style={{ marginTop: 8, color: '#666' }}>
                本月新增: {monthlySummary.members?.new_count || 0} 人
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="近6个月销售趋势">
            <ReactECharts option={trendOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="本月品类销售占比">
            <ReactECharts option={categoryOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
