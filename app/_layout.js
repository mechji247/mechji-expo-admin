import { Stack , useRouter , useSegments } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { useEffect , useState } from "react";
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