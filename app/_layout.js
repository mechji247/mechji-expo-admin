import { Stack , useRouter , useSegments, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from "expo-status-bar";
import { useEffect , useRef , useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Provider , useDispatch , useSelector } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../lib/constants/theme';
import { selectAdminStatus , selectAdminRefreshLoading, refreshAdminSession, resetAdminAuthState } from '../store/slices/adminSlice';
import { store } from '../store/store';
import {  clearTokens, hasStoredSession, saveTokens} from '../lib/tokens/secureTokens';
import { registerAdminPushToken, addNotificationResponseListener, addNotificationReceivedListener } from '../lib/services/pushNotifications';
import { fetchUnreadCount as fetchAdminNotificationUnreadCount } from '../store/slices/adminNotificationInboxSlice';


const EVENT_ROUTE_MAP = {
  vendor_registration: (targetId) => (targetId ? `/vendors/${targetId}` : '/vendors'),
  new_product: (targetId) => (targetId ? `/products/${targetId}` : '/products'),
  new_service: (targetId) => (targetId ? `/services/${targetId}` : '/services'),
  new_report: () => '/trust-safety',
};


const SESSION_REFRESH_INTERVAL_MS = 14 * 60 * 1000;

function RootNavigator () {
        const dispatch = useDispatch();
        const status = useSelector(selectAdminStatus);
        const [loading , setLoading] = useState(true)
        const isBootstrapping = useSelector(selectAdminRefreshLoading);
        const segments = useSegments();
        const router = useRouter();
        const rootNavigation = useRootNavigationState();
        const [pendingNotification, setPendingNotification] = useState(null);
        const lastNotification = useRef(null);

        const startAdminSession = async () => {
              try {
                const session = await hasStoredSession();
  
                if(!session){
                  dispatch(resetAdminAuthState())
                  router.replace("login")
                  setLoading(false);
                  return
                };

                const response = await dispatch(refreshAdminSession());
                if(response.type === "mechjiAdmin/refreshSession/fulfilled"){
                  await saveTokens({ accessToken : response?.payload?.accessToken , refreshToken : response?.payload?.refreshToken });
                  router.replace("/")
                  setLoading(false);
                  return;
                }else{
                  await clearTokens();
                  dispatch(resetAdminAuthState());
                  setLoading(false);
                  router.replace('login');
                  return;
                }

              } catch (error) {
                console.error('Error on creating new session:', error?.response?.data?.message || error?.message || error);
                dispatch(resetAdminAuthState());
                clearTokens();
                setLoading(false);
                router.replace('login');
              }finally{
                setLoading(false);
              }
        }

        useEffect(() => {
            startAdminSession();
        },[]);

        const refreshIntervalRef = useRef(null);
        const isRefreshingRef = useRef(false);

  
        const refreshSessionNow = async () => {
          if (isRefreshingRef.current) return;
          isRefreshingRef.current = true;

          try {
            const response = await dispatch(refreshAdminSession());

            if (response.type === "mechjiAdmin/refreshSession/fulfilled") {
              await saveTokens({
                accessToken: response?.payload?.accessToken,
                refreshToken: response?.payload?.refreshToken,
              });
            } else {
              await clearTokens();
              dispatch(resetAdminAuthState());
              router.replace('login');
            }
          } catch (error) {
            console.error('Background session refresh failed:', error?.response?.data?.message || error?.message || error);
          } finally {
            isRefreshingRef.current = false;
          }
        };

        const stopRefreshInterval = () => {
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
          }
        };

        const startRefreshInterval = () => {
          if (refreshIntervalRef.current) return;
          refreshIntervalRef.current = setInterval(refreshSessionNow, SESSION_REFRESH_INTERVAL_MS);
        };

      
        useEffect(() => {
          if (status !== 'authenticated') {
            stopRefreshInterval();
            return undefined;
          }

          if (AppState.currentState === 'active') {
            startRefreshInterval();
          }

          const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
              refreshSessionNow();
              startRefreshInterval();
            } else {
              stopRefreshInterval();
            }
          });

          return () => {
            subscription.remove();
            stopRefreshInterval();
          };
        }, [status]);

      
        useEffect(() => {
          if (status !== 'authenticated') return;
          registerAdminPushToken();
          const token = Notifications.addPushTokenListener(() => registerAdminPushToken({ requestPermission: false }));
          const app = AppState.addEventListener('change', state => {
            if (state === 'active') registerAdminPushToken({ requestPermission: false });
          });
          return () => { token.remove(); app.remove(); };
        }, [status]);

  
        useEffect(() => {
          let active = true;
          const receive = (response) => {
            if (!active || !response) return;
            const identifier = response.notification?.request?.identifier;
            if (identifier === lastNotification.current) return;
            lastNotification.current = identifier;
            const data = response?.notification?.request?.content?.data || {};
            const resolveRoute = EVENT_ROUTE_MAP[data.type];
            setPendingNotification(resolveRoute ? resolveRoute(encodeURIComponent(String(data.targetId || ''))) : '/notifications');
          };
          const subscription = addNotificationResponseListener(receive);
          Notifications.getLastNotificationResponseAsync().then(receive).catch(() => {});

          return () => { active = false; subscription.remove(); };
        }, []);

        // A push that arrives while the app is already in the foreground —
        // refresh only the unread COUNT (never the full inbox list), same
        // "don't fetch full history just for the badge" rule the other role
        // apps' foreground handlers follow. There's no Socket.IO client for
        // admins today (see server/sockets/utils/notificationEmit.js), so
        // this is the admin app's only source of a live badge update short
        // of the admin manually reopening the inbox screen.
        useEffect(() => {
          if (status !== 'authenticated') return undefined;
          const subscription = addNotificationReceivedListener(() => {
            dispatch(fetchAdminNotificationUnreadCount());
          });
          return () => subscription.remove();
        }, [status, dispatch]);

        useEffect(() => {
          if (loading || status !== 'authenticated' || !rootNavigation?.key || !pendingNotification) return;
          router.push(pendingNotification);
          setPendingNotification(null);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }, [loading, status, rootNavigation?.key, pendingNotification, router]);

        if (loading) {
          return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }else{

          return (
            <Stack screenOptions={{ headerShown : false }}>
                <Stack.Screen name="(auth)"/>
                <Stack.Screen name="(tabs)"/>
            </Stack>
          )
        }

}


export default function RootLayout() {
        return (
          <SafeAreaProvider>
              <Provider store={store}>
                <RootNavigator/>
                <StatusBar style="dark"/>
              </Provider>
          </SafeAreaProvider>
        );
}
