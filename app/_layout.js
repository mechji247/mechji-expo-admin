import { Stack , useRouter , useSegments } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Provider , useDispatch , useSelector } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootstrapSession , selectAdminStatus , selectIsBootstrapping } from '../store/slices/adminSlice';
import { store } from '../store/store';



function RootNavigator () {
        const dispatch = useDispatch();
        const status = useSelector(selectAdminStatus);
        const isBootstrapping = useSelector(selectIsBootstrapping);
        const segments = useSegments();
        const router = useRouter();

        useEffect(() => {
          dispatch(bootstrapSession());
        },[]);

        useEffect(() => {
          if(isBootstrapping) return;

          const inTabGroup = segments[0] === "(tabs)";
          const onMfaScreen = segments[0] === "(mfa)";

          if(status === "authenticated" && !inTabGroup) {
            router.replace('/(tabs)');
          } else if(status === "mfaRequired" && !onMfaScreen) {
            router.replace("/mfa");
          }else if(status === "unauthenticated" && (inTabGroup || onMfaScreen)) {
            router.replace("/login");
          }

        },[status , isBootstrapping , segments]);

        return (
          <Stack screenOptions={{ headerShown : false }}>
              <Stack.Screen name="login"/>
              <Stack.Screen name="mfa"/>
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