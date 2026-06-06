import { useState, useEffect } from 'react';
import { Card, Descriptions, Table, Tag, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { salesApi } from '../api/types';

function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadDetail(Number(id));
    }
  }, [id]);

  const loadDetail = async (orderId: number) => {
    setLoading(true);
    try {
      const data = await salesApi.detail(orderId);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '商品名称',
      dataIndex: 'product_name',
      width: 200,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 120,
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '单价(元)',
      dataIndex: 'unit_price',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
    {
      title: '小计(元)',
      dataIndex: 'subtotal',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
  ];

  const grossProfit = detail ? detail.total_amount - detail.total_cost : 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/sales')}
        >
          返回销售列表
        </Button>
      </div>

      <Card 
        title="销售单详情" 
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        {detail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单编号">
              <b>{detail.order_no}</b>
            </Descriptions.Item>
            <Descriptions.Item label="订单类型">
              {detail.order_type === 'retail' ? (
                <Tag>零售</Tag>
              ) : (
                <Tag color="blue">批发</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="会员信息">
              {detail.member_name || '散客'}
            </Descriptions.Item>
            <Descriptions.Item label="下单时间">
              {detail.created_at}
            </Descriptions.Item>
            <Descriptions.Item label="商品总数">
              {detail.total_quantity} 件
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {detail.remark || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card title="商品明细" style={{ marginBottom: 16 }}>
        <Table
          columns={columns}
          dataSource={detail?.items || []}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card size="small">
        <div style={{ textAlign: 'right' }}>
          <Space size="large">
            <div>
              <span style={{ color: '#666' }}>合计金额：</span>
              <span style={{ color: '#ff4d4f', fontSize: 20, fontWeight: 'bold' }}>
                ¥{detail?.total_amount?.toFixed(2) || '0.00'}
              </span>
            </div>
            <div>
              <span style={{ color: '#666' }}>成本：</span>
              <span>¥{detail?.total_cost?.toFixed(2) || '0.00'}</span>
            </div>
            <div>
              <span style={{ color: '#666' }}>毛利：</span>
              <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                ¥{grossProfit?.toFixed(2) || '0.00'}
              </span>
            </div>
          </Space>
        </div>
      </Card>
    </div>
  );
}

export default SaleDetail;
