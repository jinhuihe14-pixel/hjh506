import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  BarChartOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  PayCircleOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Purchase from './pages/Purchase';
import Sales from './pages/Sales';
import Members from './pages/Members';
import Reports from './pages/Reports';
import Stocktake from './pages/Stocktake';
import Pos from './pages/Pos';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/pos', icon: <PayCircleOutlined />, label: '快速收银' },
  { key: '/products', icon: <ShoppingOutlined />, label: '商品档案' },
  { key: '/inventory', icon: <InboxOutlined />, label: '库存管理' },
  { key: '/purchase', icon: <AppstoreOutlined />, label: '采购入库' },
  { key: '/sales', icon: <ShoppingCartOutlined />, label: '销售出库' },
  { key: '/members', icon: <UserOutlined />, label: '会员管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据分析' },
  { key: '/stocktake', icon: <FileTextOutlined />, label: '库存盘点' }
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = location.pathname === '/' ? '/' : 
    menuItems.find(item => location.pathname.startsWith(item.key))?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ 
          height: 64, 
          margin: 16, 
          background: 'rgba(255,255,255,0.2)', 
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 12 : 18,
          fontWeight: 'bold'
        }}>
          {collapsed ? '渔具' : '渔具门店管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center',
          fontSize: 18,
          fontWeight: 500,
          borderBottom: '1px solid #f0f0f0'
        }}>
          渔具门店库存管理系统
        </Header>
        <Content style={{ margin: '24px', background: '#fff', padding: 24, borderRadius: 8, minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<Pos />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/members" element={<Members />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/stocktake" element={<Stocktake />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
