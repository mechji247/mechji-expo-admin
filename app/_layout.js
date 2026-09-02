import { Stack , useRouter , useSegments } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Provider , useDispatch , useSelector } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../lib/constants/theme';
import { selectAdminStatus , selectAdminRefreshLoading, refreshAdminSession, resetAdminAuthState } from '../store/slices/adminSlice';
import { store } from '../store/store';
import {  clearTokens, hasStoredSession, saveTokens} from '../lib/tokens/secureTokens';


function RootNavigator () {
        const dispatch = useDispatch();
        const status = useSelector(selectAdminStatus);
        const isBootstrapping = useSelector(selectAdminRefreshLoading);
        const segments = useSegments();
        const router = useRouter();

        const startAdminSession = async () => {
              try {
                const session = await hasStoredSession();
  
                if(!session){
                  dispatch(resetAdminAuthState())
                  router.replace("login")
                  return
                };

                const response = await dispatch(refreshAdminSession());
                if(response.type === "mechjiAdmin/refreshSession/fulfilled"){
                  await saveTokens({ accessToken : response?.payload?.accessToken , refreshToken : response?.payload?.refreshToken });
                  router.replace("/")
                  return;
                }

              } catch (error) {
                console.error('Error on creating new session:', error?.response?.data?.message || error?.message || error);
                dispatch(resetAdminAuthState());
                clearTokens();
                router.replace('login');
              }
        }

        useEffect(() => {
          if(isBootstrapping) return;
 
          const inAuthGroup = segments[0] === "(auth)";
          const inTabGroup = segments[0] === "(tabs)";
          const onMfaScreen = inAuthGroup && segments[1] === "mfa";
 
          if(status === "authenticated" && !inTabGroup) {
            router.replace('/(tabs)');
          } else if(status === "mfaRequired" && !onMfaScreen) {
            router.replace("/mfa");
          }else if(status === "unauthenticated" && (inTabGroup || onMfaScreen)) {
            router.replace("/login");
          }
 
        },[status , isBootstrapping , segments , router]);

        useEffect(() => {
            startAdminSession();
        },[]);

  
        if (isBootstrapping) {
          return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }

        return (
          <Stack screenOptions={{ headerShown : false }}>
              <Stack.Screen name="(auth)"/>
              <Stack.Screen name="(tabs)"/>
          </Stack>
        )
}


export default function RootLayout() {
        return (
          <SafeAreaProvider>
              <Provider store={store}>
                <RootNavigator/>
                <StatusBar style="auto"/>
              </Provider>
          </SafeAreaProvider>
        );
}