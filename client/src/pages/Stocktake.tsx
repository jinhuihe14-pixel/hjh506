import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, InputNumber, Popconfirm, Card, Statistic, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, CheckOutlined, DownloadOutlined } from '@ant-design/icons';
import { stocktakeApi, categoryApi, exportApi } from '../api/types';

function Stocktake() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>();
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadCategories();
    loadData();
  }, [page, pageSize, status]);

  const loadCategories = async () => {
    const data = await categoryApi.list();
    setCategories(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await stocktakeApi.list({ page, pageSize, status });
      setList(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setCreateVisible(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      await stocktakeApi.create(values);
      message.success('盘点单创建成功');
      setCreateVisible(false);
      loadData();
    } catch (e) {}
  };

  const handleView = async (id: number) => {
    const data = await stocktakeApi.detail(id);
    setDetail(data);
    setDetailVisible(true);
    setEditing(false);
  };

  const handleEdit = async (id: number) => {
    const data = await stocktakeApi.detail(id);
    setDetail(data);
    setDetailVisible(true);
    setEditing(true);
  };

  const handleUpdateItem = async (itemId: number, value: number) => {
    if (!detail) return;
    try {
      await stocktakeApi.updateItem(detail.id, itemId, value);
      message.success('更新成功');
      const data = await stocktakeApi.detail(detail.id);
      setDetail(data);
    } catch (e) {}
  };

  const handleComplete = async (id: number) => {
    try {
      await stocktakeApi.complete(id);
      message.success('盘点完成，库存已更新');
      setDetailVisible(false);
      loadData();
    } catch (e) {}
  };

  const handleExport = (id: number) => {
    window.open(exportApi.stocktake(id), '_blank');
  };

  const columns = [
    { title: '盘点单号', dataIndex: 'stocktake_no', width: 180 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100,
      render: (v: string) => {
        if (v === 'draft') return <Tag>待盘点</Tag>;
        if (v === 'completed') return <Tag color="green">已完成</Tag>;
        return v;
      }
    },
    { title: '差异数量', dataIndex: 'total_diff_quantity', width: 100, render: (v: number) => {
      if (v === 0) return '0';
      return <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}{v}</span>;
    }},
    { title: '差异金额', dataIndex: 'total_diff_amount', width: 110, render: (v: number) => {
      if (v === 0) return '¥0.00';
      return <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}¥{v.toFixed(2)}</span>;
    }},
    { title: '备注', dataIndex: 'remark' },
    { title: '创建时间', dataIndex: 'created_at', width: 180 },
    { title: '完成时间', dataIndex: 'completed_at', width: 180, render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" onClick={() => handleEdit(record.id)}>录入盘点</Button>
          )}
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record.id)}>导出</Button>
        </Space>
      )
    }
  ];

  const itemColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'product_name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '账面库存', dataIndex: 'system_quantity', width: 100 },
    { 
      title: '实盘数量', 
      dataIndex: 'actual_quantity', 
      width: 130,
      render: (v: number | null, record: any) => {
        if (editing && detail?.status === 'draft') {
          return (
            <InputNumber 
              min={0}
              value={v}
              onChange={(val) => handleUpdateItem(record.id, val || 0)}
              style={{ width: '100%' }}
              placeholder="请输入"
            />
          );
        }
        return v !== null ? v : '-';
      }
    },
    { 
      title: '差异数量', 
      dataIndex: 'diff_quantity', 
      width: 100,
      render: (v: number | null) => {
        if (v === null || v === undefined) return '-';
        if (v === 0) return '0';
        return <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}{v}</span>;
      }
    },
    { title: '单位成本', dataIndex: 'unit_cost', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` },
    { 
      title: '差异金额', 
      dataIndex: 'diff_amount', 
      width: 110,
      render: (v: number | null) => {
        if (v === null || v === undefined) return '-';
        if (v === 0) return '¥0.00';
        return <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}¥{v.toFixed(2)}</span>;
      }
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Select 
          placeholder="状态筛选" 
          style={{ width: 150 }}
          allowClear
          value={status}
          onChange={setStatus}
          options={[
            { label: '待盘点', value: 'draft' },
            { label: '已完成', value: 'completed' }
          ]}
        />
        <Button type="primary" onClick={handleCreate} icon={<PlusOutlined />}>
          创建盘点单
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="盘点单总数" value={total} suffix="单" />
          </Card>
        </Col>
      </Row>

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
      />

      <Modal
        title="创建盘点单"
        open={createVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="盘点分类">
            <Select 
              placeholder="留空则盘点全部商品"
              allowClear
              options={categories.map(c => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div>
            盘点单详情
            {detail?.status === 'draft' && editing && <Tag color="blue">编辑中</Tag>}
          </div>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={1000}
        footer={detail?.status === 'draft' && editing ? [
          <Button key="cancel" onClick={() => setEditing(false)}>取消</Button>,
          <Popconfirm 
            key="complete" 
            title="确定完成盘点？完成后将自动调整库存。"
            onConfirm={() => detail && handleComplete(detail.id)}
          >
            <Button type="primary" icon={<CheckOutlined />}>完成盘点</Button>
          </Popconfirm>
        ] : null}
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div><b>单号：</b>{detail.stocktake_no}</div>
              <div>
                <b>状态：</b>
                {detail.status === 'draft' ? <Tag>待盘点</Tag> : <Tag color="green">已完成</Tag>}
              </div>
            </div>

            {detail.items && (
              <Table
                columns={itemColumns}
                dataSource={detail.items}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 900 }}
              />
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>
              <span style={{ marginRight: 24 }}>
                差异数量: 
                <b style={{ color: detail.total_diff_quantity > 0 ? '#52c41a' : detail.total_diff_quantity < 0 ? '#ff4d4f' : '#000' }}>
                  {detail.total_diff_quantity > 0 ? '+' : ''}{detail.total_diff_quantity}
                </b>
              </span>
              <span>
                差异金额: 
                <b style={{ color: detail.total_diff_amount > 0 ? '#52c41a' : detail.total_diff_amount < 0 ? '#ff4d4f' : '#000', fontSize: 16 }}>
                  {detail.total_diff_amount > 0 ? '+' : ''}¥{detail.total_diff_amount.toFixed(2)}
                </b>
              </span>
            </div>

            {detail.remark && (
              <div style={{ marginTop: 12, color: '#666' }}><b>备注：</b>{detail.remark}</div>
            )}
            <div style={{ marginTop: 8, color: '#666' }}><b>创建时间：</b>{detail.created_at}</div>
            {detail.completed_at && (
              <div style={{ color: '#666' }}><b>完成时间：</b>{detail.completed_at}</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Stocktake;
