// Opens today's material exactly: one technique in «Мой план поддержки» or the Guide topic.
import { useCallback } from 'react';
import { useNavigation } from './useNavigation';
import { setTechniquesTarget } from './techniquesTarget';
import { setPendingActionMaterial, type TodayMaterial } from './todayAction';

export function useOpenTodayMaterial(): (material: TodayMaterial) => void {
  const { push } = useNavigation();
  return useCallback((material: TodayMaterial) => {
    setPendingActionMaterial(material);
    if (material.kind === 'technique' && material.module) {
      setTechniquesTarget({ module: material.module, title: material.title, protocolId: material.id });
      push('techniques');
    } else {
      push('guide');
    }
  }, [push]);
}
