import { useEffect, useState } from 'react';
import type { Category } from '../../core/categories.ts';
import { groupForReview, type ReviewGroup } from '../../core/review.ts';
import { ReviewScreen } from '../ReviewScreen.tsx';
import { navigate } from '../router.ts';
import { loadWhileMounted } from '../load.ts';
import { newId } from '../new-id.ts';
import { useStore } from '../useStore.ts';

/** Everything waiting for a category, one decision per merchant. */
export function ReviewPage() {
  const store = useStore();
  const [data, setData] = useState<{ groups: ReviewGroup[]; categories: Category[] } | null>(null);

  useEffect(
    () =>
      loadWhileMounted(
        () => Promise.all([store.listTransactions(), store.listCategories()]),
        ([transactions, categories]) => setData({ groups: groupForReview(transactions), categories }),
      ),
    [store],
  );

  if (!data) return null;
  return (
    <ReviewScreen
      groups={data.groups}
      categories={data.categories}
      onSave={(decisions) =>
        void store
          .applyReviewDecisions(decisions, { now: new Date().toISOString(), newId: newId })
          .then(() => navigate('overview'))
      }
      onSkip={() => navigate('overview')}
    />
  );
}
