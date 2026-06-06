import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Modal, Form, message, Space, Popconfirm, Tag, Statistic, Row, Col, Card, Divider, List } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { memberApi } from '../api/types';

const fishingTypes = ['台钓', '路亚', '海钓', '筏钓', '其他'];
const fishingTypeFilters = ['全部', '台钓', '路亚'];
const memberLevels = ['普通', '银卡', '金卡', '钻石'];

function Members() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [fishingType, setFishingType] = useState<string | undefined>();
  const [fishingTypeFilter, setFishingTypeFilter] = useState<string>('全部');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [page, pageSize, fishingTypeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filterType = fishingTypeFilter === '全部' ? undefined : fishingTypeFilter;
      const res: any = await memberApi.list({ 
        page, pageSize, keyword, fishing_type: filterType,
        sort_by: 'total_spent', sort_order: 'desc'
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

  const handleFishingTypeFilterChange = (value: string) => {
    setFishingTypeFilter(value);
    setPage(1);
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
    try {
      await memberApi.remove(id);
      message.success('删除成功');
      loadData();
    } catch (e: any) {
    }
  };

  const validatePhone = async (_: any, value: string) => {
    if (!value) {
      return Promise.resolve();
    }
    if (!/^\d{11}$/.test(value)) {
      return Promise.reject('请输入11位数字的手机号');
    }
    return Promise.resolve();
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
    } catch (e: any) {
      if (e.message && e.message.includes('该手机号已注册')) {
        form.setFields([
          {
            name: 'phone',
            errors: ['该手机号已注册'],
          },
        ]);
      }
    }
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
        <div style={{ display: 'flex', gap: 0, border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
          {fishingTypeFilters.map(type => (
            <button
              key={type}
              style={{
                padding: '6px 16px',
                border: 'none',
                background: fishingTypeFilter === type ? '#1677ff' : '#fff',
                color: fishingTypeFilter === type ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: 14
              }}
              onClick={() => handleFishingTypeFilterChange(type)}
            >
              {type}
            </button>
          ))}
        </div>
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
          <Form.Item name="phone" label="电话" rules={[{ validator: validatePhone }]}>
            <Input placeholder="请输入11位手机号" maxLength={11} />
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
              <h4 style={{ marginBottom: 12 }}>最近消费记录（最近10笔）</h4>
              {detail.recent_orders && detail.recent_orders.length > 0 ? (
                <div>
                  {detail.recent_orders.map((order: any) => (
                    <div key={order.id} style={{ marginBottom: 16 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                        marginBottom: 8
                      }}>
                        <span style={{ fontWeight: 500 }}>{order.order_no}</span>
                        <span style={{ color: '#999', fontSize: 12 }}>{order.created_at}</span>
                        <span>
                          {order.order_type === 'retail' ? <Tag style={{ fontSize: 12 }}>零售</Tag> : <Tag style={{ fontSize: 12 }} color="blue">批发</Tag>}
                          <span style={{ marginLeft: 8, fontWeight: 500, color: '#ff4d4f' }}>¥{order.total_amount.toFixed(2)}</span>
                        </span>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <List
                          size="small"
                          dataSource={order.items}
                          renderItem={(item: any) => (
                            <List.Item>
                              <span style={{ flex: 1 }}>{item.product_name}</span>
                              <span style={{ color: '#666' }}>x{item.quantity}</span>
                              <span style={{ color: '#ff4d4f', marginLeft: 16 }}>¥{item.subtotal.toFixed(2)}</span>
                            </List.Item>
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂无消费记录</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Members;
