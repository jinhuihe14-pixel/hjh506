import { useState, useEffect } from 'react';
import { 
  Input, Select, Card, Button, List, Tag, InputNumber, 
  message, Radio, Empty, Avatar, Divider, Badge, Space, Tooltip 
} from 'antd';
import { 
  SearchOutlined, ShoppingCartOutlined, DeleteOutlined, 
  PlusOutlined, MinusOutlined, UserOutlined, GoldOutlined,
  ShopOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { productApi, categoryApi, memberApi, salesApi } from '../api/types';
import type { Product } from '../api/types';

const { Option } = Select;

interface CartItem extends Product {
  quantity: number;
  subtotal: number;
  cart_unit_price: number;
}

function Pos() {
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'retail' | 'wholesale'>('retail');
  
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberOptions, setMemberOptions] = useState<any[]>([]);
  const [recommendData, setRecommendData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, categoryId]);

  useEffect(() => {
    if (selectedMember) {
      loadRecommendData(selectedMember.id);
      loadMemberDetail(selectedMember.id);
    } else {
      setRecommendData(null);
      setRecentOrders([]);
    }
  }, [selectedMember]);

  const loadCategories = async () => {
    const data = await categoryApi.list();
    setCategories(data);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res: any = await productApi.list({ 
        page: 1, 
        pageSize: 100, 
        keyword, 
        category_id: categoryId 
      });
      setProducts(res.list || []);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendData = async (memberId: number) => {
    try {
      const data = await memberApi.recommendProducts(memberId);
      setRecommendData(data);
    } catch (e) {}
  };

  const loadMemberDetail = async (memberId: number) => {
    try {
      const data: any = await memberApi.detail(memberId);
      setRecentOrders(data.recent_orders || []);
    } catch (e) {}
  };

  const searchMembers = async (value: string) => {
    setMemberSearch(value);
    if (value) {
      const data = await memberApi.search(value);
      setMemberOptions(data);
    }
  };

  const addToCart = (product: Product) => {
    if (!product.stock_quantity || product.stock_quantity <= 0) {
      message.warning('该商品库存不足');
      return;
    }
    
    const unitPrice = orderType === 'wholesale' 
      ? (product.wholesale_price || product.retail_price || 0) 
      : (product.retail_price || 0);
    
    setCart(prev => {
      const exist = prev.find(item => item.id === product.id);
      if (exist) {
        if (exist.quantity >= (product.stock_quantity || 0)) {
          message.warning('超出库存数量');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { 
                ...item, 
                quantity: item.quantity + 1, 
                subtotal: (item.quantity + 1) * item.cart_unit_price 
              }
            : item
        );
      }
      return [...prev, {
        ...product,
        quantity: 1,
        cart_unit_price: unitPrice,
        subtotal: unitPrice
      }];
    });
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    const product = cart.find(item => item.id === productId);
    if (!product) return;
    
    if (quantity > (product.stock_quantity || 0)) {
      message.warning('超出库存数量');
      quantity = product.stock_quantity || 0;
    }
    
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prev => prev.map(item => 
      item.id === productId 
        ? { ...item, quantity, subtotal: quantity * item.cart_unit_price }
        : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleOrderTypeChange = (e: any) => {
    const type = e.target.value;
    setOrderType(type);
    setCart(prev => prev.map(item => {
      const unitPrice = type === 'wholesale' 
        ? (item.wholesale_price || item.retail_price || 0) 
        : (item.retail_price || 0);
      return {
        ...item,
        cart_unit_price: unitPrice,
        subtotal: item.quantity * unitPrice
      };
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSettle = async () => {
    if (cart.length === 0) {
      message.error('请先添加商品');
      return;
    }
    
    setSettling(true);
    try {
      await salesApi.create({
        order_type: orderType,
        member_id: selectedMember?.id,
        member_name: selectedMember?.name,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.cart_unit_price,
          wholesale_price: item.wholesale_price
        }))
      });
      message.success('结算成功！');
      clearCart();
      setSelectedMember(null);
      setMemberSearch('');
      loadProducts();
    } catch (e) {
    } finally {
      setSettling(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)', minHeight: 600 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Card 
          size="small" 
          style={{ marginBottom: 12 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShopOutlined style={{ color: '#1677ff' }} />
              <span>商品列表</span>
            </div>
          }
          extra={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select
                placeholder="全部分类"
                style={{ width: 140 }}
                allowClear
                value={categoryId}
                onChange={setCategoryId}
                size="small"
              >
                {categories.map(c => (
                  <Option key={c.id} value={c.id}>{c.name}</Option>
                ))}
              </Select>
              <Input
                placeholder="搜索商品"
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                size="small"
                allowClear
              />
            </div>
          }
        />
        
        <div 
          style={{ 
            flex: 1, 
            overflow: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 12,
            background: '#fafafa'
          }}
        >
          {products.length === 0 ? (
            <Empty description="暂无商品" style={{ marginTop: 60 }} />
          ) : (
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12 
              }}
            >
              {products.map(product => (
                <Card
                  key={product.id}
                  size="small"
                  hoverable
                  onClick={() => addToCart(product)}
                  style={{ cursor: 'pointer' }}
                  bodyStyle={{ padding: 12 }}
                >
                  <div style={{ position: 'relative' }}>
                    <div 
                      style={{
                        width: '100%',
                        height: 80,
                        background: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 8,
                        color: '#1677ff',
                        fontSize: 32
                      }}
                    >
                      <ShoppingCartOutlined />
                    </div>
                    <div 
                      style={{ 
                        fontSize: 14, 
                        fontWeight: 500,
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {product.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                      {product.sku}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#ff4d4f', fontSize: 16, fontWeight: 'bold' }}>
                          ¥{orderType === 'wholesale' 
                            ? (product.wholesale_price || product.retail_price)?.toFixed(2) 
                            : product.retail_price?.toFixed(2)}
                        </span>
                      </div>
                      <Tag 
                        color={product.stock_quantity && product.stock_quantity > 0 ? 'green' : 'red'} 
                        style={{ margin: 0 }}
                      >
                        库存: {product.stock_quantity || 0}
                      </Tag>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div style={{ width: 380, display: 'flex', flexDirection: 'column' }}>
        <Card 
          size="small" 
          style={{ marginBottom: 12 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ color: '#722ed1' }} />
              <span>会员</span>
            </div>
          }
        >
          <Select
            showSearch
            placeholder="搜索会员（可选）"
            style={{ width: '100%' }}
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
            size="small"
          />
          
          {selectedMember && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar size={48} style={{ background: '#722ed1' }}>
                  {selectedMember.name?.charAt(0)}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 16 }}>{selectedMember.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {selectedMember.phone || '暂无电话'}
                    <Tag color="blue" style={{ marginLeft: 8 }}>{selectedMember.member_level}</Tag>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1677ff' }}>
                    ¥{selectedMember.total_spent?.toFixed(2) || '0.00'}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>累计消费</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>
                    {selectedMember.total_orders || 0}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>订单数</div>
                </div>
              </div>
              
              {recommendData && recommendData.products?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <GoldOutlined style={{ color: '#faad14' }} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>为您推荐</span>
                  </div>
                  <div style={{ maxHeight: 120, overflow: 'auto' }}>
                    {recommendData.products.slice(0, 5).map((p: any) => (
                      <div 
                        key={p.id}
                        onClick={() => addToCart(p)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: 4
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f5ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: 13 }}>{p.name}</span>
                        <span style={{ color: '#ff4d4f', fontSize: 13 }}>
                          ¥{(orderType === 'wholesale' ? p.wholesale_price : p.retail_price)?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
        
        <Card 
          size="small" 
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge count={cart.length} size="small">
                  <ShoppingCartOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                </Badge>
                <span>购物车</span>
              </div>
              <Radio.Group size="small" value={orderType} onChange={handleOrderTypeChange}>
                <Radio.Button value="retail">零售</Radio.Button>
                <Radio.Button value="wholesale">批发</Radio.Button>
              </Radio.Group>
            </div>
          }
          extra={
            cart.length > 0 && (
              <Button type="link" size="small" danger onClick={clearCart}>
                清空
              </Button>
            )
          }
          bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
        >
          {cart.length === 0 ? (
            <Empty description="购物车为空" style={{ marginTop: 40 }} />
          ) : (
            <List
              size="small"
              dataSource={cart}
              renderItem={item => (
                <List.Item
                  style={{ padding: '12px 16px' }}
                  actions={[
                    <Button 
                      type="text" 
                      danger 
                      size="small" 
                      icon={<DeleteOutlined />}
                      onClick={() => removeFromCart(item.id!)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 14 }}>{item.name}</span>}
                    description={
                      <span style={{ color: '#ff4d4f' }}>
                        ¥{item.cart_unit_price?.toFixed(2)}
                      </span>
                    }
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<MinusOutlined />}
                      onClick={() => updateCartQuantity(item.id!, item.quantity - 1)}
                    />
                    <InputNumber
                      size="small"
                      min={1}
                      max={item.stock_quantity || 999}
                      value={item.quantity}
                      onChange={v => updateCartQuantity(item.id!, v || 1)}
                      style={{ width: 60, textAlign: 'center' }}
                      controls={false}
                    />
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<PlusOutlined />}
                      onClick={() => updateCartQuantity(item.id!, item.quantity + 1)}
                    />
                    <span style={{ width: 70, textAlign: 'right', fontWeight: 500 }}>
                      ¥{item.subtotal?.toFixed(2)}
                    </span>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
        
        <Card size="small" style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>商品数量：</span>
            <span><b>{totalQuantity}</b> 件</span>
          </div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: '#666' }}>合计金额：</span>
            <span style={{ color: '#ff4d4f', fontSize: 24, fontWeight: 'bold' }}>
              ¥{totalAmount.toFixed(2)}
            </span>
          </div>
          <Button 
            type="primary" 
            size="large" 
            block
            icon={<ArrowRightOutlined />}
            onClick={handleSettle}
            loading={settling}
            disabled={cart.length === 0}
            style={{ height: 48, fontSize: 16 }}
          >
            确认结算
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default Pos;
