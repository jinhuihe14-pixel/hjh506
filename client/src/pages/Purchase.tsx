import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, message, Space, Popover, Tag, List } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseApi, productApi } from '../api/types';

function Purchase() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form] = Form.useForm();
  const [items, setItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [page, pageSize]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await purchaseApi.list({ page, pageSize, keyword });
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
    setItems([]);
    form.resetFields();
    setModalVisible(true);
  };

  const handleView = async (id: number) => {
    const data = await purchaseApi.detail(id);
    setDetail(data);
    setDetailVisible(true);
  };

  const handleAddItem = (product: any) => {
    const exist = items.find(i => i.product_id === product.id);
    if (exist) {
      message.info('商品已添加');
      return;
    }
    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity: 1,
      unit_price: product.cost_price || 0,
      subtotal: product.cost_price || 0
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].unit_price;
    }
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      message.error('请添加商品');
      return;
    }
    try {
      const values = await form.validateFields();
      await purchaseApi.create({
        ...values,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          production_date: i.production_date,
          expiry_date: i.expiry_date
        }))
      });
      message.success('入库成功');
      setModalVisible(false);
      loadData();
    } catch (e) {}
  };

  const searchProducts = async (value: string) => {
    setProductSearch(value);
    if (value) {
      const data = await productApi.search(value);
      setProductOptions(data);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const columns = [
    { title: '采购单号', dataIndex: 'order_no', width: 180 },
    { title: '供应商', dataIndex: 'supplier', width: 150 },
    { title: '总数量', dataIndex: 'total_quantity', width: 100 },
    { title: '总金额', dataIndex: 'total_amount', width: 120, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '备注', dataIndex: 'remark' },
    { title: '入库时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Input 
          placeholder="搜索单号/供应商" 
          prefix={<SearchOutlined />} 
          style={{ width: 250 }}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
        />
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增入库单</Button>
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
      />

      <Modal
        title="新增采购入库单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="确认入库"
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Form.Item name="supplier" label="供应商" style={{ flex: 1 }}>
              <Input placeholder="请输入供应商名称" />
            </Form.Item>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 500 }}>商品明细</span>
            <Select
              showSearch
              placeholder="搜索商品添加"
              style={{ width: 250, marginLeft: 16 }}
              value={productSearch || undefined}
              onSearch={searchProducts}
              filterOption={false}
              onSelect={(_: any, option: any) => {
                handleAddItem(option.data);
                setProductSearch('');
              }}
              options={productOptions.map(p => ({
                label: `${p.name} (${p.sku})`,
                value: p.id,
                data: p
              }))}
              notFoundContent="请输入关键词搜索"
            />
          </div>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, maxHeight: 300, overflow: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无商品，请搜索添加</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>商品</th>
                    <th style={{ padding: 8, width: 100 }}>数量</th>
                    <th style={{ padding: 8, width: 120 }}>单价(元)</th>
                    <th style={{ padding: 8, width: 120 }}>小计(元)</th>
                    <th style={{ padding: 8, width: 120 }}>生产日期</th>
                    <th style={{ padding: 8, width: 120 }}>保质期</th>
                    <th style={{ padding: 8, width: 60 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ padding: 8 }}>
                        <div>{item.product_name}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{item.sku}</div>
                      </td>
                      <td style={{ padding: 8 }}>
                        <InputNumber 
                          min={1} 
                          value={item.quantity} 
                          onChange={v => handleItemChange(index, 'quantity', v || 1)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <InputNumber 
                          min={0} 
                          precision={2}
                          value={item.unit_price} 
                          onChange={v => handleItemChange(index, 'unit_price', v || 0)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{item.subtotal.toFixed(2)}</td>
                      <td style={{ padding: 8 }}>
                        <DatePicker 
                          style={{ width: '100%' }}
                          value={item.production_date ? dayjs(item.production_date) : null}
                          onChange={d => handleItemChange(index, 'production_date', d?.format('YYYY-MM-DD'))}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <DatePicker 
                          style={{ width: '100%' }}
                          value={item.expiry_date ? dayjs(item.expiry_date) : null}
                          onChange={d => handleItemChange(index, 'expiry_date', d?.format('YYYY-MM-DD'))}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <Button type="link" danger size="small" onClick={() => handleRemoveItem(index)}>删除</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <span style={{ marginRight: 24 }}>共 <b>{totalQty}</b> 件</span>
            <span>合计: <b style={{ color: '#1677ff', fontSize: 18 }}>¥{totalAmount.toFixed(2)}</b></span>
          </div>

          <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="采购单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div><b>单号：</b>{detail.order_no}</div>
              <div><b>供应商：</b>{detail.supplier || '-'}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>商品明细：</b>
            </div>
            <List
              dataSource={detail.items}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.name}
                    description={`SKU: ${item.sku} | 分类: ${item.category_name || '-'}`}
                  />
                  <div>
                    <span style={{ marginRight: 16 }}>数量: {item.quantity}</span>
                    <span style={{ marginRight: 16 }}>单价: ¥{item.unit_price.toFixed(2)}</span>
                    <span>小计: <b>¥{item.subtotal.toFixed(2)}</b></span>
                  </div>
                </List.Item>
              )}
            />
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>
              <span style={{ marginRight: 24 }}>共 <b>{detail.total_quantity}</b> 件</span>
              <span>总计: <b style={{ color: '#1677ff', fontSize: 18 }}>¥{detail.total_amount.toFixed(2)}</b></span>
            </div>
            {detail.remark && (
              <div style={{ marginTop: 12, color: '#666' }}><b>备注：</b>{detail.remark}</div>
            )}
            <div style={{ marginTop: 12, color: '#666' }}><b>入库时间：</b>{detail.created_at}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Purchase;
