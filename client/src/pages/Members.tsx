import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Modal, Form, message, Space, Popconfirm, Tag, Statistic, Row, Col, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { memberApi } from '../api/types';

const fishingTypes = ['台钓', '路亚', '海钓', '筏钓', '其他'];
const memberLevels = ['普通', '银卡', '金卡', '钻石'];

function Members() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [fishingType, setFishingType] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [page, pageSize, fishingType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await memberApi.list({ 
        page, pageSize, keyword, fishing_type: fishingType 
      });
      setList(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleView = async (id: number) => {
    const data = await memberApi.detail(id);
    setDetail(data);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    await memberApi.remove(id);
    message.success('删除成功');
    loadData();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await memberApi.update(editingItem.id, values);
        message.success('修改成功');
      } else {
        await memberApi.create(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (e) {}
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '电话', dataIndex: 'phone', width: 130 },
    { 
      title: '会员等级', 
      dataIndex: 'member_level', 
      width: 100,
      render: (v: string) => {
        const colors: Record<string, string> = {
          '普通': 'default',
          '银卡': 'blue',
          '金卡': 'gold',
          '钻石': 'purple'
        };
        return <Tag color={colors[v]}>{v}</Tag>;
      }
    },
    { 
      title: '垂钓类型', 
      dataIndex: 'fishing_type', 
      width: 100,
      render: (v: string) => v || '-'
    },
    { title: '累计消费', dataIndex: 'total_spent', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '订单数', dataIndex: 'total_orders', width: 80 },
    { title: '注册时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Input 
          placeholder="搜索姓名/电话" 
          prefix={<SearchOutlined />} 
          style={{ width: 250 }}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
        />
        <Select 
          placeholder="垂钓类型" 
          style={{ width: 120 }}
          allowClear
          value={fishingType}
          onChange={setFishingType}
          options={fishingTypes.map(t => ({ label: t, value: t }))}
        />
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增会员</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="会员总数" value={total} suffix="人" valueStyle={{ color: '#1677ff' }} />
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
        title={editingItem ? '编辑会员' : '新增会员'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="member_level" label="会员等级" style={{ flex: 1 }} initialValue="普通">
              <Select options={memberLevels.map(l => ({ label: l, value: l }))} />
            </Form.Item>
            <Form.Item name="fishing_type" label="垂钓类型" style={{ flex: 1 }}>
              <Select 
                allowClear
                placeholder="请选择"
                options={fishingTypes.map(t => ({ label: t, value: t }))} 
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title="会员详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <div>
                <div style={{ color: '#666', fontSize: 13 }}>姓名</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{detail.name}</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 13 }}>电话</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{detail.phone || '-'}</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 13 }}>会员等级</div>
                <Tag color="blue">{detail.member_level}</Tag>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: 13 }}>垂钓类型</div>
                <div>{detail.fishing_type || '-'}</div>
              </div>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="累计消费" value={detail.total_spent} precision={2} suffix="元" />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="订单总数" value={detail.total_orders} suffix="单" />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic 
                    title="客单价" 
                    value={detail.total_orders > 0 ? (detail.total_spent / detail.total_orders).toFixed(2) : 0} 
                    suffix="元" 
                  />
                </Card>
              </Col>
            </Row>

            <div>
              <h4>最近订单</h4>
              {detail.recent_orders && detail.recent_orders.length > 0 ? (
                detail.recent_orders.map((order: any) => (
                  <div key={order.id} style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{order.order_no}</span>
                    <span>
                      {order.order_type === 'retail' ? <Tag style={{ fontSize: 12 }}>零售</Tag> : <Tag style={{ fontSize: 12 }} color="blue">批发</Tag>}
                      <span style={{ marginLeft: 12 }}>¥{order.total_amount.toFixed(2)}</span>
                    </span>
                    <span style={{ color: '#999' }}>{order.created_at}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无订单</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Members;
