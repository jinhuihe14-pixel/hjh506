import { useState, useEffect } from 'react';
import { 
  Tabs, Card, Row, Col, Statistic, DatePicker, Select, Table, Button, Tag, 
  Empty, List, Avatar, Collapse, Tooltip 
} from 'antd';
import { 
  DownloadOutlined, WarningOutlined, ClockCircleOutlined, ShoppingOutlined,
  UserOutlined, CrownOutlined, RiseOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { reportsApi, memberApi, exportApi } from '../api/types';

const { MonthPicker } = DatePicker;

function Reports() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [summary, setSummary] = useState<any>(null);
  const [productStats, setProductStats] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [memberStats, setMemberStats] = useState<any[]>([]);
  const [fishingTypes, setFishingTypes] = useState<any[]>([]);
  const [categoryPreference, setCategoryPreference] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [yoyData, setYoyData] = useState<any>(null);
  
  const [memberPortraitList, setMemberPortraitList] = useState<any[]>([]);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [memberDetailStats, setMemberDetailStats] = useState<any>(null);

  const [replenishmentList, setReplenishmentList] = useState<any[]>([]);
  const [expiryList, setExpiryList] = useState<any[]>([]);
  const [slowMovingList, setSlowMovingList] = useState<any[]>([]);
  const [expiryDays, setExpiryDays] = useState(30);
  const [slowDays, setSlowDays] = useState(60);

  useEffect(() => {
    loadDailyReports();
  }, [expiryDays, slowDays]);

  useEffect(() => {
    loadMonthlyReports();
  }, [month]);

  const loadDailyReports = async () => {
    const [repl, exp, slow] = await Promise.all([
      reportsApi.replenishment(),
      reportsApi.expiry(expiryDays),
      reportsApi.slowMoving(slowDays)
    ]);
    setReplenishmentList(repl);
    setExpiryList(exp);
    setSlowMovingList(slow);
  };

  const loadMonthlyReports = async () => {
    const [sum, prod, cat, mem, ft, cp, trend, yoy, portrait] = await Promise.all([
      reportsApi.monthlySummary(month),
      reportsApi.monthlyProducts(month),
      reportsApi.monthlyCategories(month),
      reportsApi.monthlyMembers(month),
      reportsApi.fishingTypes(month),
      reportsApi.categoryPreference(month),
      reportsApi.salesTrend(6),
      reportsApi.yoy(month),
      reportsApi.monthlyMemberPortrait(month, 10)
    ]);
    setSummary(sum);
    setProductStats(prod);
    setCategoryStats(cat);
    setMemberStats(mem);
    setFishingTypes(ft);
    setCategoryPreference(cp);
    setSalesTrend(trend);
    setYoyData(yoy);
    setMemberPortraitList(portrait);
    setExpandedMemberId(null);
    setMemberDetailStats(null);
  };

  const handleMemberExpand = async (memberId: number) => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
      setMemberDetailStats(null);
      return;
    }
    setExpandedMemberId(memberId);
    try {
      const data = await memberApi.consumptionStats(memberId, 3);
      setMemberDetailStats(data);
    } catch (e) {}
  };

  const productColumns = [
    { title: '排名', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'SKU', dataIndex: 'sku', width: 100 },
    { title: '商品名称', dataIndex: 'name', width: 160 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '销售数量', dataIndex: 'sales_quantity', width: 100, sorter: (a: any, b: any) => a.sales_quantity - b.sales_quantity },
    { title: '销售金额', dataIndex: 'sales_amount', width: 110, render: (v: number) => `¥${v.toFixed(2)}`, sorter: (a: any, b: any) => a.sales_amount - b.sales_amount },
    { title: '毛利', dataIndex: 'gross_profit', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '毛利率', dataIndex: 'gross_margin', width: 90, render: (v: number) => `${v}%` },
    { title: '期末库存', dataIndex: 'current_stock', width: 90 },
    { title: '库存周转天数', dataIndex: 'turnover_days', width: 110, render: (v: number) => v ? `${v}天` : '-' }
  ];

  const categoryColumns = [
    { title: '排名', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: '品类', dataIndex: 'category_name', width: 120 },
    { title: '商品数', dataIndex: 'product_count', width: 80 },
    { title: '销售数量', dataIndex: 'sales_quantity', width: 100 },
    { title: '销售金额', dataIndex: 'sales_amount', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '毛利', dataIndex: 'gross_profit', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '毛利率', dataIndex: 'gross_margin', width: 90, render: (v: number) => `${v}%` },
    { title: '库存数量', dataIndex: 'total_stock', width: 100 },
    { title: '库存金额', dataIndex: 'stock_value', width: 110, render: (v: number) => `¥${v.toFixed(2)}` }
  ];

  const memberColumns = [
    { title: '排名', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '电话', dataIndex: 'phone', width: 130 },
    { title: '会员等级', dataIndex: 'member_level', width: 90 },
    { title: '垂钓类型', dataIndex: 'fishing_type', width: 90, render: (v: string) => v || '-' },
    { title: '订单数', dataIndex: 'order_count', width: 80 },
    { title: '消费金额', dataIndex: 'total_amount', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '购买数量', dataIndex: 'total_quantity', width: 90 },
    { title: '客单价', dataIndex: 'avg_order_amount', width: 100, render: (v: number) => `¥${v.toFixed(2)}` }
  ];

  const replenishColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '当前库存', dataIndex: 'current_stock', width: 100, render: (v: number) => <Tag color="red">{v}</Tag> },
    { title: '安全库存', dataIndex: 'safety_stock', width: 100 },
    { title: '需补货数量', dataIndex: 'need_quantity', width: 110, render: (v: number) => <b style={{ color: '#ff4d4f' }}>{v}</b> },
    { title: '平均成本', dataIndex: 'avg_cost', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` }
  ];

  const expiryColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '当前库存', dataIndex: 'current_stock', width: 100 },
    { title: '批次数量', dataIndex: 'batch_quantity', width: 100 },
    { title: '生产日期', dataIndex: 'production_date', width: 110 },
    { title: '到期日期', dataIndex: 'expiry_date', width: 110, render: (v: string) => <Tag color="orange">{v}</Tag> },
    { title: '剩余天数', dataIndex: 'expiry_date', width: 100, render: (v: string) => {
      const days = dayjs(v).diff(dayjs(), 'day');
      return days <= 7 ? <Tag color="red">{days}天</Tag> : <Tag color="orange">{days}天</Tag>;
    }}
  ];

  const slowColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '当前库存', dataIndex: 'current_stock', width: 100 },
    { title: '平均成本', dataIndex: 'avg_cost', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` },
    { title: '库存金额', dataIndex: 'stock_value', width: 110, render: (v: number) => `¥${v?.toFixed(2)}` },
    { title: '未成交天数', dataIndex: 'days_no_sale', width: 110, render: (v: number) => <Tag color="red">{v}天</Tag> },
    { title: '最后出库', dataIndex: 'last_out_date', width: 160, render: (v: string) => v || '从未销售' }
  ];

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '订单数'] },
    xAxis: { type: 'category', data: salesTrend.map(item => item.month) },
    yAxis: [
      { type: 'value', name: '销售额(元)' },
      { type: 'value', name: '订单数' }
    ],
    series: [
      {
        name: '销售额',
        type: 'bar',
        data: salesTrend.map(item => item.sales_amount),
        itemStyle: { color: '#1677ff' },
        label: { show: true, position: 'top', formatter: (p: any) => `¥${p.value}` }
      },
      {
        name: '订单数',
        type: 'line',
        yAxisIndex: 1,
        data: salesTrend.map(item => item.order_count),
        itemStyle: { color: '#52c41a' },
        smooth: true
      }
    ]
  };

  const categoryPieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: categoryStats.slice(0, 8).map(item => ({
        name: item.category_name,
        value: item.sales_amount
      }))
    }]
  };

  const fishingTypeOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: fishingTypes.map(item => item.fishing_type || '未分类') },
    yAxis: { type: 'value', name: '消费金额(元)' },
    series: [{
      type: 'bar',
      data: fishingTypes.map(item => item.total_amount),
      itemStyle: { color: '#722ed1' },
      label: { show: true, position: 'top', formatter: (p: any) => `¥${p.value}` }
    }]
  };

  const prefOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', name: '消费金额(元)' },
    yAxis: { type: 'category', data: categoryPreference.map(item => item.category_name || '其他').reverse() },
    series: [{
      type: 'bar',
      data: categoryPreference.map(item => item.total_amount).reverse(),
      itemStyle: { color: '#fa8c16' },
      label: { show: true, position: 'right', formatter: (p: any) => `¥${p.value}` }
    }]
  };

  const tabItems = [
    {
      key: 'daily',
      label: '每日清单',
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic 
                  title={<span><WarningOutlined style={{ color: '#ff4d4f' }} /> 待补货商品</span>} 
                  value={replenishmentList.length} 
                  suffix="种"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic 
                  title={<span><ClockCircleOutlined style={{ color: '#fa8c16' }} /> 临期饵料</span>} 
                  value={expiryList.length} 
                  suffix="种"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic 
                  title={<span><ShoppingOutlined style={{ color: '#722ed1' }} /> 滞销产品</span>} 
                  value={slowMovingList.length} 
                  suffix="种"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Card 
            title="补货清单（库存低于安全线）" 
            size="small" 
            style={{ marginBottom: 16 }}
          >
            {replenishmentList.length === 0 ? (
              <Empty description="暂无需要补货的商品" />
            ) : (
              <Table
                columns={replenishColumns}
                dataSource={replenishmentList}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 900 }}
              />
            )}
          </Card>

          <Card 
            title={
              <span>
                临期清单（
                <Select 
                  size="small" 
                  style={{ width: 100 }} 
                  value={expiryDays}
                  onChange={setExpiryDays}
                  options={[
                    { label: '7天内', value: 7 },
                    { label: '15天内', value: 15 },
                    { label: '30天内', value: 30 },
                    { label: '60天内', value: 60 },
                    { label: '90天内', value: 90 }
                  ]}
                />
                到期）
              </span>
            } 
            size="small" 
            style={{ marginBottom: 16 }}
          >
            {expiryList.length === 0 ? (
              <Empty description="暂无临期商品" />
            ) : (
              <Table
                columns={expiryColumns}
                dataSource={expiryList}
                rowKey={(record: any) => record.id + record.expiry_date}
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 1000 }}
              />
            )}
          </Card>

          <Card 
            title={
              <span>
                滞销清单（连续
                <Select 
                  size="small" 
                  style={{ width: 100 }} 
                  value={slowDays}
                  onChange={setSlowDays}
                  options={[
                    { label: '30天', value: 30 },
                    { label: '60天', value: 60 },
                    { label: '90天', value: 90 },
                    { label: '180天', value: 180 }
                  ]}
                />
                无成交）
              </span>
            } 
            size="small"
          >
            {slowMovingList.length === 0 ? (
              <Empty description="暂无滞销商品" />
            ) : (
              <Table
                columns={slowColumns}
                dataSource={slowMovingList}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 1000 }}
              />
            )}
          </Card>
        </div>
      )
    },
    {
      key: 'monthly',
      label: '月度分析',
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <MonthPicker 
              value={dayjs(month)} 
              onChange={d => d && setMonth(d.format('YYYY-MM'))} 
              style={{ width: 150 }}
            />
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(exportApi.monthlyReport(month), '_blank')}>
              导出月度报表
            </Button>
          </div>

          {summary && (
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="销售总额" 
                    value={summary.sales?.sales_amount || 0} 
                    precision={2}
                    suffix="元"
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="毛利" 
                    value={summary.sales?.gross_profit || 0} 
                    precision={2}
                    suffix="元"
                    valueStyle={{ color: '#52c41a' }}
                  />
                  <div style={{ color: '#666', marginTop: 4 }}>
                    毛利率: {summary.sales?.gross_margin || 0}%
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="订单数" 
                    value={summary.sales?.order_count || 0} 
                    suffix="单"
                  />
                  <div style={{ color: '#666', marginTop: 4 }}>
                    零售 {summary.sales?.retail_orders || 0} / 批发 {summary.sales?.wholesale_orders || 0}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="采购金额" 
                    value={summary.purchase?.purchase_amount || 0} 
                    precision={2}
                    suffix="元"
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {yoyData && (
            <Card title="同比环比分析" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div style={{ color: '#666', marginBottom: 8 }}>本月</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1677ff' }}>
                    ¥{yoyData.current?.sales_amount?.toFixed(2)}
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    {yoyData.current_month}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#666', marginBottom: 8 }}>环比上月</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    ¥{yoyData.last_month?.sales_amount?.toFixed(2)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={yoyData.last_month?.growth_amount >= 0 ? 'green' : 'red'}>
                      {yoyData.last_month?.growth_amount >= 0 ? '↑' : '↓'} 
                      {Math.abs(yoyData.last_month?.growth_amount || 0)}%
                    </Tag>
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                      {yoyData.last_month?.month}
                    </span>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#666', marginBottom: 8 }}>同比去年</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    ¥{yoyData.last_year?.sales_amount?.toFixed(2)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={yoyData.last_year?.growth_amount >= 0 ? 'green' : 'red'}>
                      {yoyData.last_year?.growth_amount >= 0 ? '↑' : '↓'} 
                      {Math.abs(yoyData.last_year?.growth_amount || 0)}%
                    </Tag>
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                      {yoyData.last_year?.month}
                    </span>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          <Card title="近6个月销售趋势" size="small" style={{ marginBottom: 16 }}>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title="品类销售占比" size="small">
                <ReactECharts option={categoryPieOption} style={{ height: 280 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="垂钓类型客户消费对比" size="small">
                <ReactECharts option={fishingTypeOption} style={{ height: 280 }} />
              </Card>
            </Col>
          </Row>

          <Card title="会员品类偏好分析" size="small" style={{ marginBottom: 16 }}>
            <ReactECharts option={prefOption} style={{ height: 300 }} />
          </Card>

          <Card title="单品销售排行" size="small" style={{ marginBottom: 16 }}>
            <Table
              columns={productColumns}
              dataSource={productStats}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1100 }}
            />
          </Card>

          <Card title="品类分析" size="small" style={{ marginBottom: 16 }}>
            <Table
              columns={categoryColumns}
              dataSource={categoryStats}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
            />
          </Card>

          <Card 
            title={
              <span>
                <CrownOutlined style={{ color: '#faad14', marginRight: 8 }} />
                会员消费画像
              </span>
            } 
            size="small" 
            style={{ marginBottom: 16 }}
          >
            {memberPortraitList.length === 0 ? (
              <Empty description="暂无会员消费数据" />
            ) : (
              <List
                size="small"
                dataSource={memberPortraitList}
                renderItem={(member, index) => (
                  <List.Item
                    style={{ 
                      padding: '12px 16px',
                      background: expandedMemberId === member.id ? '#f0f5ff' : 'transparent',
                      borderRadius: 8,
                      marginBottom: index < memberPortraitList.length - 1 ? 8 : 0,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleMemberExpand(member.id)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          style={{ 
                            background: index < 3 
                              ? ['#faad14', '#d9d9d9', '#d48806'][index] 
                              : '#722ed1' 
                          }}
                        >
                          {index < 3 ? index + 1 : member.name?.charAt(0)}
                        </Avatar>
                      }
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 500 }}>{member.name}</span>
                          <Tag color="blue" style={{ margin: 0 }}>{member.member_level}</Tag>
                        </div>
                      }
                      description={
                        <div style={{ marginTop: 4 }}>
                          <div style={{ marginBottom: 4 }}>
                            {member.preferred_categories?.slice(0, 3).map((cat: string, i: number) => (
                              <Tag key={i} color="purple" style={{ marginRight: 4, marginBottom: 4 }}>
                                {cat}
                              </Tag>
                            ))}
                          </div>
                          <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 16 }}>
                            <span>
                              <RiseOutlined style={{ color: '#52c41a' }} /> 
                              客单价 ¥{member.avg_order_amount?.toFixed(2)}
                            </span>
                            <span>
                              <ClockCircleOutlined style={{ color: '#1677ff' }} /> 
                              每{member.visit_frequency}天来店一次
                            </span>
                          </div>
                        </div>
                      }
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#999' }}>本月消费</div>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ff4d4f' }}>
                        ¥{member.total_amount?.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {member.order_count} 单
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
            
            {expandedMemberId && memberDetailStats && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" title="近3个月消费趋势">
                      <ReactECharts 
                        option={{
                          tooltip: { trigger: 'axis' },
                          xAxis: { 
                            type: 'category', 
                            data: memberDetailStats.trend?.map((t: any) => t.month) || [] 
                          },
                          yAxis: [
                            { type: 'value', name: '金额(元)' },
                            { type: 'value', name: '订单数' }
                          ],
                          series: [
                            {
                              name: '消费金额',
                              type: 'line',
                              data: memberDetailStats.trend?.map((t: any) => t.total_amount) || [],
                              smooth: true,
                              itemStyle: { color: '#1677ff' },
                              areaStyle: { opacity: 0.2 }
                            },
                            {
                              name: '订单数',
                              type: 'line',
                              yAxisIndex: 1,
                              data: memberDetailStats.trend?.map((t: any) => t.order_count) || [],
                              smooth: true,
                              itemStyle: { color: '#52c41a' }
                            }
                          ]
                        }} 
                        style={{ height: 240 }} 
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="购买品类占比">
                      <ReactECharts 
                        option={{
                          tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
                          legend: { orient: 'vertical', right: 10, top: 'center' },
                          series: [{
                            type: 'pie',
                            radius: ['40%', '70%'],
                            data: memberDetailStats.category_stats?.map((c: any) => ({
                              name: c.category_name || '其他',
                              value: c.total_amount
                            })) || []
                          }]
                        }} 
                        style={{ height: 240 }} 
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
          </Card>

          <Card title="会员消费排行" size="small">
            <Table
              columns={memberColumns}
              dataSource={memberStats}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 900 }}
            />
          </Card>
        </div>
      )
    }
  ];

  return (
    <div>
      <Tabs defaultActiveKey="daily" items={tabItems} size="large" />
    </div>
  );
}

export default Reports;
