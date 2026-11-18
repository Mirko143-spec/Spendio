import { useEffect, useState } from 'react';
import type { Category } from '../../core/categories.ts';
import { groupForReview, type ReviewGroup } from '../../core/review.ts';
import { ReviewScreen } from '../ReviewScreen.tsx';
import { navigate } from '../router.ts';
import { useStore } from '../useStore.ts';

/** Everything waiting for a category, one decision per merchant. */
export function ReviewPage() {
  const store = useStore();
  const [data, setData] = useState<{ groups: ReviewGroup[]; categories: Category[] } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([store.listTransactions(), store.listCategories()]).then(([transactions, categories]) => {
      if (live) setData({ groups: groupForReview(transactions), categories });
    });
    return () => {
      live = false;
    };
  }, [store]);

  if (!data) return null;
  return (
    <ReviewScreen
      groups={data.groups}
      categories={data.categories}
      onSave={(decisions) =>
        void store
          .applyReviewDecisions(decisions, { now: new Date().toISOString(), newId: () => crypto.randomUUID() })
          .then(() => navigate('overview'))
      }
      onSkip={() => navigate('overview')}
    />
  );
}
