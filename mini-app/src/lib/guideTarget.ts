// guideTarget.ts — «открой Гид сразу на нужной карточке»: навигация приложения передаёт
// только ID экрана (push('guide')), без параметров, поэтому ссылка из «Самочувствия»
// («И почитайте в Гиде: Мозг») кладёт тег карточки сюда, а GuideScreen забирает его при
// открытии. Одноразовый: после чтения сбрасывается, обычный вход в Гид (папка, нижняя
// навигация) по-прежнему открывается с первой карточки.
import type { GuideTag } from '../content/guide';

let pendingTag: GuideTag | null = null;

export function setGuideTarget(tag: GuideTag): void {
  pendingTag = tag;
}

export function consumeGuideTarget(): GuideTag | null {
  const tag = pendingTag;
  pendingTag = null;
  return tag;
}
