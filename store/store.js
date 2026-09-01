import { configureStore } from '@reduxjs/toolkit';

import adminReducer from './slices/adminSlice';
import adminDashboardReducer from './slices/adminDashboardSlice';
import adminVendorReducer from './slices/adminVendorSlice';
import legalAdminReducer from './slices/legalAdminSlice';
import adminCurrentUserReducer from './slices/userAdminSlice'


export const store = configureStore({
  reducer: {
    mechjiAdmin: adminReducer,
    adminDashboard: adminDashboardReducer,
    adminVendor: adminVendorReducer,
    legalAdmin: legalAdminReducer,
    adminCurrentUser: adminCurrentUserReducer,
  },
});