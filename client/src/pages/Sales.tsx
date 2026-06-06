import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, List, Tag, Radio } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { salesApi, productApi, memberApi } from '../api/types';

function Sales() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [orderType, setOrderType] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form] = Form.useForm();
  const [items, setItems] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [orderTypeValue, setOrderTypeValue] = useState('retail');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberOptions, setMemberOptions] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [page, pageSize, orderType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await salesApi.list({ page, pageSize, keyword, order_type: orderType });
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
    setSelectedMember(null);
    setOrderTypeValue('retail');
    setMemberSearch('');
    form.resetFields();
    setModalVisible(true);
  };

  const handleView = async (id: number) => {
    const data = await salesApi.detail(id);
    setDetail(data);
    setDetailVisible(true);
  };

  const handleAddItem = (product: any) => {
    const exist = items.find(i => i.product_id === product.id);
    if (exist) {
      message.info('商品已添加');
      return;
    }
    if (product.stock_quantity === 0) {
      message.warning('该商品库存不足');
      return;
    }
    const unitPrice = orderTypeValue === 'wholesale' ? (product.wholesale_price || product.retail_price) : product.retail_price;
    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      stock: product.stock_quantity || 0,
      quantity: 1,
      unit_price: unitPrice,
      retail_price: product.retail_price,
      wholesale_price: product.wholesale_price || product.retail_price,
      subtotal: unitPrice
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'quantity') {
      if (value > newItems[index].stock) {
        message.warning('超出库存数量');
        value = newItems[index].stock;
      }
      newItems[index].quantity = value;
      newItems[index].subtotal = value * newItems[index].unit_price;
    } else if (field === 'unit_price') {
      newItems[index].unit_price = value;
      newItems[index].subtotal = newItems[index].quantity * value;
    }
    setItems(newItems);
  };

  const handleOrderTypeChange = (e: any) => {
    const type = e.target.value;
    setOrderTypeValue(type);
    const newItems = items.map(item => ({
      ...item,
      unit_price: type === 'wholesale' ? item.wholesale_price : item.retail_price,
      subtotal: item.quantity * (type === 'wholesale' ? item.wholesale_price : item.retail_price)
    }));
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      message.error('请添加商品');
      return;
    }
    try {
      await salesApi.create({
        order_type: orderTypeValue,
        member_id: selectedMember?.id,
        member_name: selectedMember?.name,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price
        })),
        remark: form.getFieldValue('remark')
      });
      message.success('销售单创建成功');
      setModalVisible(false);
      loadData();
    } catch (e) {}
  };

  const searchMembers = async (value: string) => {
    setMemberSearch(value);
    if (value) {
      const data = await memberApi.search(value);
      setMemberOptions(data);
    }
  };

  const searchProducts = async (value: string) => {
    if (value) {
      const data = await productApi.search(value);
      // 这里没有productOptions state，我需要简化一下
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const columns = [
    { title: '销售单号', dataIndex: 'order_no', width: 180 },
    { 
      title: '订单类型', 
      dataIndex: 'order_type', 
      width: 100,
      render: (v: string) => v === 'retail' ? <Tag>零售</Tag> : <Tag color="blue">批发</Tag>
    },
    { title: '客户', dataIndex: 'member_name', width: 120, render: (v: string) => v || '散客' },
    { title: '总数量', dataIndex: 'total_quantity', width: 90 },
    { title: '总金额', dataIndex: 'total_amount', width: 110, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '成本', dataIndex: 'total_cost', width: 100, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '备注', dataIndex: 'remark' },
    { title: '下单时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
      )
    }
  ];

  // 简化的商品选择
  const [productKeyword, setProductKeyword] = useState('');
  const [productOptions, setProductOptions] = useState<any[]>([]);

  const handleProductSearch = async (value: string) => {
    setProductKeyword(value);
    if (value) {
      const data = await productApi.search(value);
      setProductOptions(data);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Input 
          placeholder="搜索单号/客户名" 
          prefix={<SearchOutlined />} 
          style={{ width: 250 }}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
        />
        <Select 
          placeholder="订单类型" 
          style={{ width: 120 }}
          allowClear
          value={orderType}
          onChange={setOrderType}
          options={[
            { label: '零售', value: 'retail' },
            { label: '批发', value: 'wholesale' }
          ]}
        />
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增销售单</Button>
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
        title="新增销售单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="确认出库"
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
            <Form.Item label="订单类型" style={{ marginBottom: 0 }}>
              <Radio.Group value={orderTypeValue} onChange={handleOrderTypeChange}>
                <Radio value="retail">零售</Radio>
                <Radio value="wholesale">批发</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item label="会员选择" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                showSearch
                placeholder="搜索会员（可选）"
                value={selectedMember ? selectedMember.id : undefined}
                onSearch={searchMembers}
                filterOption={false}
                onSelect={(value: any, option: any) => setSelectedMember(option.data)}
                options={memberOptions.map(m => ({
                  label: `${m.name} (${m.phone || '无电话'})`,
                  value: m.id,
                  data: m
                }))}
                notFoundContent="请输入关键词搜索会员"
                allowClear
                onClear={() => setSelectedMember(null)}
              />
            </Form.Item>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 500 }}>商品明细</span>
            <Select
              showSearch
              placeholder="搜索商品添加"
              style={{ width: 250, marginLeft: 16 }}
              value={productKeyword || undefined}
              onSearch={handleProductSearch}
              filterOption={false}
              onSelect={(_: any, option: any) => {
                handleAddItem(option.data);
                setProductKeyword('');
              }}
              options={productOptions.map(p => ({
                label: `${p.name} (库存:${p.stock_quantity})`,
                value: p.id,
                data: p
              }))}
              notFoundContent="请输入关键词搜索"
            />
          </div>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, maxHeight: 280, overflow: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无商品，请搜索添加</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>商品</th>
                    <th style={{ padding: 8, width: 80 }}>库存</th>
                    <th style={{ padding: 8, width: 90 }}>数量</th>
                    <th style={{ padding: 8, width: 110 }}>单价(元)</th>
                    <th style={{ padding: 8, width: 110 }}>小计(元)</th>
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
                      <td style={{ padding: 8 }}>{item.stock}</td>
                      <td style={{ padding: 8 }}>
                        <InputNumber 
                          min={1} 
                          max={item.stock}
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
        title="销售单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div><b>单号：</b>{detail.order_no}</div>
              <div>
                <b>类型：</b>
                {detail.order_type === 'retail' ? <Tag>零售</Tag> : <Tag color="blue">批发</Tag>}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>客户：</b>{detail.member_name || '散客'}
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>商品明细：</b>
            </div>
            <List
              dataSource={detail.items}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.product_name}
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
              <div>
                <span style={{ marginRight: 24 }}>共 <b>{detail.total_quantity}</b> 件</span>
                <span>销售总额: <b style={{ color: '#1677ff', fontSize: 18 }}>¥{detail.total_amount.toFixed(2)}</b></span>
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>
                成本: ¥{detail.total_cost.toFixed(2)} 
                &nbsp;&nbsp;毛利: ¥{(detail.total_amount - detail.total_cost).toFixed(2)}
              </div>
            </div>
            {detail.remark && (
              <div style={{ marginTop: 12, color: '#666' }}><b>备注：</b>{detail.remark}</div>
            )}
            <div style={{ marginTop: 12, color: '#666' }}><b>下单时间：</b>{detail.created_at}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Sales;
