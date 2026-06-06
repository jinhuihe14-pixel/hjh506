import { useState, useEffect } from 'react';
import { 
  Table, Button, Input, Select, Card, Statistic, Row, Col, Tag, Tabs, 
  DatePicker, Modal, Timeline, Empty, Tooltip, Typography 
} from 'antd';
import { 
  SearchOutlined, DownloadOutlined, WarningOutlined, 
  ClockCircleOutlined, RiseOutlined, FallOutlined,
  ShoppingCartOutlined, ShoppingOutlined, FileTextOutlined
} from '@ant-design/icons';
import { inventoryApi, categoryApi, exportApi } from '../api/types';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

function Inventory() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [logList, setLogList] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  
  const [traceVisible, setTraceVisible] = useState(false);
  const [traceProduct, setTraceProduct] = useState<any>(null);
  const [traceLogs, setTraceLogs] = useState<any[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [tracePage, setTracePage] = useState(1);
  const [traceTotal, setTraceTotal] = useState(0);

  useEffect(() => {
    loadCategories();
    loadOverview();
  }, []);

  useEffect(() => {
    loadData();
  }, [page, pageSize, keyword, categoryId, lowStockOnly]);

  useEffect(() => {
    if (logPage) {
      loadLogs();
    }
  }, [logPage]);

  const loadCategories = async () => {
    const data = await categoryApi.list();
    setCategories(data);
  };

  const loadOverview = async () => {
    const data = await inventoryApi.overview();
    setOverview(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await inventoryApi.list({ 
        page, pageSize, keyword, category_id: categoryId, low_stock: lowStockOnly 
      });
      setList(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    const res: any = await inventoryApi.logs({ page: logPage, pageSize: 20 });
    setLogList(res.list);
    setLogTotal(res.total);
  };

  const loadTraceLogs = async (productId: number, pageNum: number = 1) => {
    setTraceLoading(true);
    try {
      const res: any = await inventoryApi.logs({ 
        product_id: productId, 
        page: pageNum, 
        pageSize: 20 
      });
      if (pageNum === 1) {
        setTraceLogs(res.list);
      } else {
        setTraceLogs(prev => [...prev, ...res.list]);
      }
      setTraceTotal(res.total);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleTrace = (record: any) => {
    setTraceProduct(record);
    setTracePage(1);
    setTraceLogs([]);
    setTraceVisible(true);
    loadTraceLogs(record.product_id, 1);
  };

  const handleRefClick = (log: any) => {
    if (log.ref_type === 'sale' && log.ref_id) {
      navigate(`/sales`);
    } else if (log.ref_type === 'purchase' && log.ref_id) {
      navigate(`/purchase`);
    } else if (log.ref_type === 'stocktake' && log.ref_id) {
      navigate(`/stocktake`);
    }
  };

  const loadMoreTrace = () => {
    const nextPage = tracePage + 1;
    setTracePage(nextPage);
    loadTraceLogs(traceProduct.product_id, nextPage);
  };

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleExport = () => {
    window.open(exportApi.inventory(), '_blank');
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    { 
      title: '库存数量', 
      dataIndex: 'quantity', 
      width: 120,
      render: (v: number, record: any) => {
        const content = record.is_low_stock 
          ? <Tag color="red" icon={<WarningOutlined />}>{v}</Tag>
          : <span style={{ color: '#1677ff', cursor: 'pointer', textDecoration: 'underline' }}>{v}</span>;
        return (
          <Tooltip title="点击查看库存追溯">
            <span onClick={() => handleTrace(record)} style={{ cursor: 'pointer' }}>
              {content}
            </span>
          </Tooltip>
        );
      }
    },
    { title: '安全库存', dataIndex: 'safety_stock', width: 90 },
    { title: '平均成本', dataIndex: 'avg_cost', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` },
    { 
      title: '库存金额', 
      dataIndex: 'stock_value', 
      width: 110, 
      render: (_: any, record: any) => `¥${(record.quantity * record.avg_cost).toFixed(2)}` 
    },
    { title: '保质期(天)', dataIndex: 'shelf_life_days', width: 100, render: (v: number) => v || '-' },
    { title: '最后入库', dataIndex: 'last_in_date', width: 160 },
    { title: '最后出库', dataIndex: 'last_out_date', width: 160, render: (v: string) => v || '-' }
  ];

  const logColumns = [
    { title: '时间', dataIndex: 'created_at', width: 180 },
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { 
      title: '变动类型', 
      dataIndex: 'change_type', 
      width: 100,
      render: (v: string) => v === 'in' ? <Tag color="green">入库</Tag> : <Tag color="red">出库</Tag>
    },
    { title: '变动数量', dataIndex: 'change_quantity', width: 100 },
    { title: '变动前库存', dataIndex: 'before_quantity', width: 110 },
    { title: '变动后库存', dataIndex: 'after_quantity', width: 110 },
    { title: '关联类型', dataIndex: 'ref_type', width: 100 },
    { title: '备注', dataIndex: 'remark' }
  ];

  const tabItems = [
    {
      key: '1',
      label: '库存列表',
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input 
              placeholder="搜索商品名称/SKU" 
              prefix={<SearchOutlined />} 
              style={{ width: 250 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Select 
              placeholder="选择分类" 
              style={{ width: 150 }}
              allowClear
              value={categoryId}
              onChange={(v) => setCategoryId(v)}
              options={categories.map(c => ({ label: c.name, value: c.id }))}
            />
            <Select 
              value={lowStockOnly ? 'low' : undefined} 
              style={{ width: 150 }}
              onChange={(v) => setLowStockOnly(v === 'low')}
              options={[
                { label: '全部商品', value: undefined },
                { label: '低于安全库存', value: 'low' }
              ]}
            />
            <Button type="primary" onClick={handleSearch}>查询</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出Excel</Button>
          </div>

          <Table
            columns={columns}
            dataSource={list}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); }
            }}
            scroll={{ x: 1300 }}
          />
        </>
      )
    },
    {
      key: '2',
      label: '出入库流水',
      children: (
        <div style={{ paddingTop: 16 }}>
          <Table
            columns={logColumns}
            dataSource={logList}
            rowKey="id"
            pagination={{
              current: logPage,
              pageSize: 20,
              total: logTotal,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (p) => setLogPage(p)
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      )
    }
  ];

  return (
    <div>
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
              title="库存总数量" 
              value={overview.totalStock || 0} 
              suffix="件"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="库存总金额" 
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
              title="低于安全库存" 
              value={overview.lowStockCount || 0} 
              suffix="种"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs items={tabItems} defaultActiveKey="1" />
      
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <span>库存追溯 - {traceProduct?.name || ''}</span>
          </div>
        }
        open={traceVisible}
        onCancel={() => setTraceVisible(false)}
        footer={null}
        width={600}
      >
        {traceProduct && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>SKU: {traceProduct.sku}</div>
                <div style={{ fontSize: 12, color: '#999' }}>分类: {traceProduct.category_name || '-'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#999' }}>当前库存</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1677ff' }}>
                  {traceProduct.quantity} {traceProduct.unit || ''}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          {traceLogs.length === 0 && !traceLoading ? (
            <Empty description="暂无库存变动记录" style={{ padding: '40px 0' }} />
          ) : (
            <Timeline
              mode="left"
              items={traceLogs.map((log: any) => {
                const isIn = log.change_type === 'in' || log.change_type === 'purchase_in' || log.change_quantity > 0;
                const getRefIcon = () => {
                  switch (log.ref_type) {
                    case 'sale': return <ShoppingCartOutlined />;
                    case 'purchase': return <ShoppingOutlined />;
                    case 'stocktake': return <FileTextOutlined />;
                    default: return null;
                  }
                };
                const getRefTypeLabel = () => {
                  if (log.remark) return log.remark;
                  switch (log.ref_type) {
                    case 'sale': return '销售出库';
                    case 'purchase': return '采购入库';
                    case 'stocktake': return '盘点调整';
                    default: return isIn ? '入库' : '出库';
                  }
                };
                
                return {
                  color: isIn ? 'green' : 'red',
                  dot: isIn ? <RiseOutlined /> : <FallOutlined />,
                  children: (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={isIn ? 'green' : 'red'} style={{ marginBottom: 6 }}>
                          {getRefIcon()} {getRefTypeLabel()}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {log.created_at}
                        </Text>
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        变动数量: 
                        <span style={{ 
                          color: isIn ? '#52c41a' : '#ff4d4f', 
                          fontWeight: 'bold',
                          marginLeft: 8
                        }}>
                          {isIn ? '+' : ''}{log.change_quantity} {traceProduct?.unit || ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        变动前: {log.before_quantity} → 变动后: <b>{log.after_quantity}</b>
                      </div>
                      {log.ref_no && (
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: '#999' }}>关联单号: </span>
                          <a onClick={() => handleRefClick(log)} style={{ cursor: 'pointer' }}>
                            {log.ref_no}
                          </a>
                        </div>
                      )}
                      {log.remark && log.ref_type && (
                        <div style={{ fontSize: 12, color: '#999' }}>
                          备注: {log.remark}
                        </div>
                      )}
                    </div>
                  )
                };
              })}
            />
          )}
          
          {traceLogs.length < traceTotal && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Button onClick={loadMoreTrace} loading={traceLoading}>
                加载更多
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Inventory;
