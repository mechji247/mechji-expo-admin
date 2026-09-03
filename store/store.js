import { configureStore } from '@reduxjs/toolkit';

import adminReducer from './slices/adminSlice';
import adminDashboardReducer from './slices/adminDashboardSlice';
import adminVendorReducer from './slices/adminVendorSlice';
import legalAdminReducer from './slices/legalAdminSlice';
import adminCurrentUserReducer from './slices/userAdminSlice'
import manageAdminsReducer from './slices/manageAdminsSlice';
import vendorStaffReducer from './slices/vendorStaffSlice';
import subscriptionsReducer from './slices/subscriptionsSlice';
import reviewsReducer from './slices/reviewsSlice';
import promotionsReducer from './slices/promotionsSlice';
import notificationsReducer from './slices/notificationsSlice';
import chatReducer from './slices/chatSlice';
import trustSafetyReducer from './slices/trustSafetySlice';


export const store = configureStore({
  reducer: {
    mechjiAdmin: adminReducer,
    adminDashboard: adminDashboardReducer,
    adminVendor: adminVendorReducer,
    legalAdmin: legalAdminReducer,
    adminCurrentUser: adminCurrentUserReducer,
    manageAdmins: manageAdminsReducer,
    vendorStaff: vendorStaffReducer,
    subscriptions: subscriptionsReducer,
    reviews: reviewsReducer,
    promotions: promotionsReducer,
    notifications: notificationsReducer,
    chat: chatReducer,
    trustSafety: trustSafetyReducer,
  },
});