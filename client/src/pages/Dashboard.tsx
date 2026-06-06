import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Tag, Empty } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { inventoryApi, reportsApi, stocktakeApi } from '../api/types';

const { RangePicker } = DatePicker;

function Dashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>({});
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [latestStocktake, setLatestStocktake] = useState<any>(null);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    const [ov, trend, cat, summary, latest] = await Promise.all([
      inventoryApi.overview(),
      reportsApi.salesTrend(6),
      reportsApi.monthlyCategories(month),
      reportsApi.monthlySummary(month),
      stocktakeApi.latest()
    ]);
    setOverview(ov);
    setSalesTrend(trend);
    setCategoryStats(cat);
    setMonthlySummary(summary);
    setLatestStocktake(latest);
  };

  const handleViewStocktake = () => {
    if (latestStocktake) {
      navigate('/stocktake', { state: { stocktakeId: latestStocktake.id } });
    }
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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card 
            title={
              <span>
                <FileTextOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                最近盘点
              </span>
            }
            size="small"
            extra={latestStocktake ? (
              <Tag color="green">已完成</Tag>
            ) : null}
            style={{ cursor: latestStocktake ? 'pointer' : 'default' }}
            onClick={handleViewStocktake}
            hoverable={!!latestStocktake}
          >
            {latestStocktake ? (
              <Row gutter={16} align="middle">
                <Col span={6}>
                  <div style={{ color: '#666', marginBottom: 4 }}>盘点时间</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                    {latestStocktake.completed_at}
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    {latestStocktake.stocktake_no}
                  </div>
                </Col>
                <Col span={4}>
                  <Statistic 
                    title="盘点商品" 
                    value={latestStocktake.item_count} 
                    suffix="种"
                    valueStyle={{ color: '#1677ff', fontSize: 20 }}
                  />
                </Col>
                <Col span={4}>
                  <div style={{ color: '#666', marginBottom: 4 }}>盘盈数量</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                    +{latestStocktake.overage_quantity}
                  </div>
                  <div style={{ color: '#52c41a', fontSize: 12 }}>
                    +¥{latestStocktake.overage_amount?.toFixed(2)}
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ color: '#666', marginBottom: 4 }}>盘亏数量</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>
                    -{latestStocktake.shortage_quantity}
                  </div>
                  <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                    -¥{latestStocktake.shortage_amount?.toFixed(2)}
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ color: '#666', marginBottom: 4 }}>盘盈盘亏总金额</div>
                  <div 
                    style={{ 
                      fontSize: 22, 
                      fontWeight: 'bold',
                      color: latestStocktake.total_diff_amount > 0 ? '#52c41a' : 
                             latestStocktake.total_diff_amount < 0 ? '#ff4d4f' : '#000'
                    }}
                  >
                    {latestStocktake.total_diff_amount > 0 ? '+' : ''}
                    ¥{latestStocktake.total_diff_amount?.toFixed(2)}
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    {latestStocktake.total_diff_amount > 0 ? '盘盈' : latestStocktake.total_diff_amount < 0 ? '盘亏' : '无差异'}
                    （按成本价计算）
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty 
                description="暂无盘点记录" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: '16px 0' }}
              />
            )}
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
