import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Card, Statistic, Row, Col, Tag, Tabs, DatePicker } from 'antd';
import { SearchOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons';
import { inventoryApi, categoryApi, exportApi } from '../api/types';

function Inventory() {
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
      width: 100,
      render: (v: number, record: any) => {
        if (record.is_low_stock) {
          return <Tag color="red" icon={<WarningOutlined />}>{v}</Tag>;
        }
        return v;
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
    </div>
  );
}

export default Inventory;
