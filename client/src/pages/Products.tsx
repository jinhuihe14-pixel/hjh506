import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Modal, Form, InputNumber, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { productApi, categoryApi, type Product } from '../api/types';

function Products() {
  const [list, setList] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [categories, setCategories] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadCategories();
    loadData();
  }, [page, pageSize]);

  const loadCategories = async () => {
    const data = await categoryApi.list();
    setCategories(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await productApi.list({ 
        page, pageSize, keyword, category_id: categoryId 
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

  const handleEdit = (item: Product) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    await productApi.remove(id);
    message.success('删除成功');
    loadData();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await productApi.update(editingItem.id!, values);
        message.success('修改成功');
      } else {
        await productApi.create(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (e) {
      // 错误已在拦截器处理
    }
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', width: 180 },
    { title: '分类', dataIndex: 'category_name', width: 100 },
    { title: '单位', dataIndex: 'unit', width: 60 },
    { title: '采购成本', dataIndex: 'cost_price', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` },
    { title: '零售价', dataIndex: 'retail_price', width: 100, render: (v: number) => `¥${v?.toFixed(2)}` },
    { title: '批发价', dataIndex: 'wholesale_price', width: 100, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
    { title: '安全库存', dataIndex: 'safety_stock', width: 90 },
    { title: '保质期(天)', dataIndex: 'shelf_life_days', width: 100, render: (v: number) => v || '-' },
    { 
      title: '当前库存', 
      dataIndex: 'stock_quantity', 
      width: 100,
      render: (v: number, record: any) => {
        if (v <= record.safety_stock) {
          return <Tag color="red">{v}</Tag>;
        }
        return v;
      }
    },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Product) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id!)}>
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
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增商品</Button>
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
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingItem ? '编辑商品' : '新增商品'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sku" label="SKU编码" rules={[{ required: true, message: '请输入SKU' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="category_id" label="商品分类" style={{ flex: 1 }}>
              <Select options={categories.map(c => ({ label: c.name, value: c.id }))} />
            </Form.Item>
            <Form.Item name="unit" label="单位" style={{ flex: 1 }} initialValue="件">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="cost_price" label="采购成本(元)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
            <Form.Item name="retail_price" label="零售价(元)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
            <Form.Item name="wholesale_price" label="批发价(元)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="safety_stock" label="安全库存" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="shelf_life_days" label="保质期(天)" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1 }} initialValue={1}>
              <Select options={[
                { label: '启用', value: 1 },
                { label: '禁用', value: 0 }
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="商品描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Products;
