import type { ShoppingItem } from '@family/shared';

import { varAlpha } from 'minimal-shared/utils';
import { useState, useCallback, useMemo } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';

import { ShoppingItemRow } from '../shopping-item-row';
import { ShoppingQuickAdd } from '../shopping-quick-add';

// ----------------------------------------------------------------------

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Frozen', 'Other'];

// Mock initial items
const INITIAL_ITEMS: ShoppingItem[] = [
  { id: 'item-1', name: 'Milk', quantity: '1 gallon', category: 'Dairy', purchased: false },
  { id: 'item-2', name: 'Bread', quantity: '1 loaf', category: 'Bakery', purchased: true },
  { id: 'item-3', name: 'Apples', quantity: '6', category: 'Produce', purchased: false },
  { id: 'item-4', name: 'Chicken breast', quantity: '2 lbs', category: 'Meat', purchased: false },
  { id: 'item-5', name: 'Eggs', quantity: '1 dozen', category: 'Dairy', purchased: false },
  { id: 'item-6', name: 'Pasta', quantity: '2 boxes', category: 'Pantry', purchased: true },
  { id: 'item-7', name: 'Frozen pizza', quantity: '2', category: 'Frozen', purchased: false },
  { id: 'item-8', name: 'Bananas', quantity: '1 bunch', category: 'Produce', purchased: false },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'To Buy' },
  { value: 'purchased', label: 'Purchased' },
];

type ShoppingFilters = {
  status: string;
};

// ----------------------------------------------------------------------

export function ShoppingView() {
  const [items, setItems] = useState<ShoppingItem[]>(INITIAL_ITEMS);

  const [filters, setFilters] = useState<ShoppingFilters>({ status: 'all' });

  // Filter items based on status
  const filteredItems = useMemo(() => {
    if (filters.status === 'pending') {
      return items.filter((item) => !item.purchased);
    }
    if (filters.status === 'purchased') {
      return items.filter((item) => item.purchased);
    }
    return items;
  }, [items, filters.status]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};

    filteredItems.forEach((item) => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Sort categories by predefined order
    const sortedGroups: Record<string, ShoppingItem[]> = {};
    CATEGORIES.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });

    return sortedGroups;
  }, [filteredItems]);

  const handleFilterStatus = useCallback(
    (event: React.SyntheticEvent, newValue: string) => {
      setFilters({ status: newValue });
    },
    []
  );

  const handleAddItem = useCallback((name: string, quantity: string, category: string) => {
    const newItem: ShoppingItem = {
      id: `item-${Date.now()}`,
      name,
      quantity: quantity || undefined,
      category: category || 'Other',
      purchased: false,
    };
    setItems((prev) => [newItem, ...prev]);
  }, []);

  const handleTogglePurchased = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, purchased: !item.purchased } : item))
    );
  }, []);

  const handleDeleteItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const pendingCount = items.filter((i) => !i.purchased).length;
  const purchasedCount = items.filter((i) => i.purchased).length;

  return (
    <DashboardContent maxWidth="xl">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Typography variant="h4">Shopping List</Typography>
      </Stack>

      <ShoppingQuickAdd onAdd={handleAddItem} categories={CATEGORIES} />

      <Card sx={{ mt: 3 }}>
        <Tabs
          value={filters.status}
          onChange={handleFilterStatus}
          sx={[
            (theme) => ({
              px: { md: 2.5 },
              boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }),
          ]}
        >
          {STATUS_OPTIONS.map((tab) => (
            <Tab
              key={tab.value}
              iconPosition="end"
              value={tab.value}
              label={tab.label}
              icon={
                <Label
                  variant={
                    (tab.value === 'all' || tab.value === filters.status) ? 'filled' : 'soft'
                  }
                  color={
                    (tab.value === 'purchased' && 'success') ||
                    (tab.value === 'pending' && 'warning') ||
                    'default'
                  }
                >
                  {tab.value === 'all' && items.length}
                  {tab.value === 'pending' && pendingCount}
                  {tab.value === 'purchased' && purchasedCount}
                </Label>
              }
            />
          ))}
        </Tabs>

        <Box sx={{ p: 2 }}>
          {Object.keys(groupedItems).length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No items found
              </Typography>
            </Box>
          ) : (
            Object.entries(groupedItems).map(([category, categoryItems], index) => (
              <Box key={category} sx={{ mb: index < Object.keys(groupedItems).length - 1 ? 3 : 0 }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
                >
                  {category}
                </Typography>
                <Card variant="outlined">
                  <List disablePadding>
                    {categoryItems.map((item, itemIndex) => (
                      <Box key={item.id}>
                        {itemIndex > 0 && <Divider />}
                        <ShoppingItemRow
                          item={item}
                          onTogglePurchased={() => handleTogglePurchased(item.id)}
                          onDelete={() => handleDeleteItem(item.id)}
                        />
                      </Box>
                    ))}
                  </List>
                </Card>
              </Box>
            ))
          )}
        </Box>
      </Card>
    </DashboardContent>
  );
}
