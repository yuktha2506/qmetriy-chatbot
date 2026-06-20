import './App.scss';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import AddCompany from './pages/AddCompany';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Integration from './pages/Integration';
import TeamJeeraInsights from './pages/JiraDashboard';
import GitDashboard from './pages/GitDashboard';
import QMetirxBeta from './pages/QMetrixBeta';
import CapacityDashboard from './components/capacityPlanning/capacityPlanning';
import RolesBillingTable from './components/capacityPlanning/Roles&Billing';
import StandUpPage from './pages/StandUpPage';
import ReleaseDashboard from './pages/ReleaseDashboard';
import TechQuality from './pages/TechQuality';
import ResetPassword from './pages/ResetPassword';
import HolidayList from './components/capacityPlanning/HolidayList';
import ChatbotWidget from './components/AI/ChatbotWidget';


function ThemeSync() {
  const theme = useSelector((state) => state.theme.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

function App() {
  const route = createBrowserRouter([
    {
      path: '/addCompany',
      element: <AddCompany />,
    },
    {
      path: '/',
      element: <Login />,
    },
    {
      path: '/forgotPassword',
      element: <ForgotPassword />,
    },
    {
      path: '/resetPassword/:token',
      element: <ResetPassword />
    },
    {
      path: '/register',
      element: <Register />,
    },
    //Don't remove this comment if any one wants to see older version (CXO) then uncomment this code (for future refrence)
    // {
    //   path: '/dashboard',
    //   element: <QmetrixDashboard />,
    // },
    // {
    //   path: '/qmetrixBeta',
    //   element: <QMetirxBeta />,
    // },
    {
      path: '/dashboard',
      element: <QMetirxBeta />,
    },
    {
      path: '/standUp',
      element: <StandUpPage />,
    },
    {
      path: '/release',
      element: <ReleaseDashboard />,
    },
    {
      path: '/techQuality',
      element: <TechQuality />,
    },
    {
      path: '/integration',
      element: <Integration />,
    },
    {
      path: '/gitDashboard',
      element: <GitDashboard />,
    },
    {
      path: '/jiraDashboard',
      element: <TeamJeeraInsights />,
    },
    {
      path: '/capacityPlanning',
      element: < CapacityDashboard />
    },
    {
      path: '/Roles&Billing',
      element: < RolesBillingTable />
    },
     {
      path: '/HolidayList',
      element: <HolidayList/>
    },

  ]);

  return (
    <>
      <ThemeSync />
      <RouterProvider router={route}></RouterProvider>
      <ChatbotWidget />
    </>
  );
}

export default App;
