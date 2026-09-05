import { Stack , useRouter , useSegments } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { useEffect , useRef , useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Provider , useDispatch , useSelector } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../lib/constants/theme';
import { selectAdminStatus , selectAdminRefreshLoading, refreshAdminSession, resetAdminAuthState } from '../store/slices/adminSlice';
import { store } from '../store/store';
import {  clearTokens, hasStoredSession, saveTokens} from '../lib/tokens/secureTokens';
import { registerAdminPushToken, addNotificationResponseListener } from '../lib/services/pushNotifications';

// Where a tap on a push notification should land, keyed by the `type`
// (eventType) the backend puts in the payload's data — see
// server/push_notifications/handlers/adminAlerts. Purely a client-side
// routing concern: the payload only needs to say what happened and which
// record, not which screen renders it. new_service/new_report don't have
// a dedicated detail screen yet, so they land on the closest list screen.
const EVENT_ROUTE_MAP = {
  vendor_registration: (targetId) => (targetId ? `/vendors/${targetId}` : '/vendors'),
  new_product: (targetId) => (targetId ? `/products/${targetId}` : '/products'),
  new_service: () => '/notifications',
  new_report: () => '/trust-safety',
};

// The admin-access JWT expires after 15 minutes (server/utils/adminJwt.js).
// Silently refresh it a minute early — while the app is open AND in the
// foreground — so an admin who's actively using the app never hits a 401
// mid-action. Backgrounding the app pauses this (nothing to refresh for),
// and coming back to the foreground checks immediately in case the window
// already elapsed while backgrounded.
const SESSION_REFRESH_INTERVAL_MS = 14 * 60 * 1000;

function RootNavigator () {
        const dispatch = useDispatch();
        const status = useSelector(selectAdminStatus);
        const [loading , setLoading] = useState(true)
        const isBootstrapping = useSelector(selectAdminRefreshLoading);
        const segments = useSegments();
        const router = useRouter();

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

        // Refresh once "now" — used both by the interval tick and by the
        // app-foreground handler. Guarded against overlap (e.g. a resume
        // firing right as a scheduled tick was about to) and, on a real
        // failure (not just "nothing to refresh yet"), tears the session
        // down the same way startAdminSession does on a failed refresh.
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

        // Only run this while actually logged in, and only while the app is
        // in the foreground — pause on background, resume (with an
        // immediate check) on foreground.
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

        // Register this device for admin push notifications once signed in.
        // Safe to fire on every transition into 'authenticated' (a fresh
        // login, or the bootstrap refresh above succeeding) — the backend
        // upserts by device, so re-registering the same device is a no-op.
        useEffect(() => {
          if (status !== 'authenticated') return;
          registerAdminPushToken();
        }, [status]);

        // Tapping a push notification (app backgrounded, or opened cold
        // from a tap) navigates to the relevant screen. Set up once —
        // doesn't depend on auth status since a tap can also arrive right
        // as the app is still bootstrapping.
        useEffect(() => {
          const subscription = addNotificationResponseListener((response) => {
            const data = response?.notification?.request?.content?.data || {};
            const resolveRoute = EVENT_ROUTE_MAP[data.type];
            if (resolveRoute) {
              router.push(resolveRoute(data.targetId));
            }
          });

          return () => subscription.remove();
        }, []);

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