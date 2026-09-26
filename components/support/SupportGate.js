import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../../lib/constants/theme';
import { fetchSupportMeta, refreshSupportMeta, selectSupportMeta, selectSupportMetaError, selectSupportMetaStatus } from '../../store/slices/supportDeskSlice';
import { StateView, supportStyles } from './ui';

/**
 * Screen frame for every Support screen: header with back button, and the
 * desk metadata (the agent's role, capabilities and all labels — from
 * GET /support/meta) loaded before the children render.
 */
export default function SupportGate({ title, right, children, edges = ['top'] }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const meta = useSelector(selectSupportMeta);
  const status = useSelector(selectSupportMetaStatus);
  const error = useSelector(selectSupportMetaError);
  useEffect(() => { dispatch(fetchSupportMeta()); }, [dispatch]);

  return (
    <SafeAreaView style={supportStyles.screen} edges={edges}>
      <View style={supportStyles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={supportStyles.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {meta ? (typeof children === 'function' ? children(meta, new Set(meta.me?.capabilities || [])) : children) : (
        <StateView loading={status !== 'failed'} error={status === 'failed' ? error : null} onRetry={() => dispatch(refreshSupportMeta())} />
      )}
    </SafeAreaView>
  );
}
