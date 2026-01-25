import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ChecklistProgress } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { checklistData } from '../lib/constants'

interface ChecklistState {
  [key: string]: boolean
}

export function useChecklist() {
  const { user } = useAuth()
  const [checkedItems, setCheckedItems] = useState<ChecklistState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const getKey = (categoryIndex: number, itemIndex: number) =>
    `${categoryIndex}-${itemIndex}`

  const loadChecklist = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('checklist_progress')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error loading checklist:', error)
      setLoading(false)
      return
    }

    const newState: ChecklistState = {}
    data?.forEach((item: ChecklistProgress) => {
      newState[getKey(item.category_index, item.item_index)] = item.is_checked
    })
    setCheckedItems(newState)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadChecklist()
  }, [loadChecklist])

  const toggleItem = async (categoryIndex: number, itemIndex: number) => {
    if (!user) return

    const key = getKey(categoryIndex, itemIndex)
    const newValue = !checkedItems[key]

    setCheckedItems(prev => ({
      ...prev,
      [key]: newValue
    }))

    setSaving(true)

    const { error } = await supabase
      .from('checklist_progress')
      .upsert({
        user_id: user.id,
        category_index: categoryIndex,
        item_index: itemIndex,
        is_checked: newValue,
        checked_at: newValue ? new Date().toISOString() : null
      }, {
        onConflict: 'user_id,category_index,item_index'
      })

    if (error) {
      console.error('Error saving checklist item:', error)
      setCheckedItems(prev => ({
        ...prev,
        [key]: !newValue
      }))
    }

    setSaving(false)
  }

  const isChecked = (categoryIndex: number, itemIndex: number) =>
    !!checkedItems[getKey(categoryIndex, itemIndex)]

  const getCategoryProgress = (categoryIndex: number) => {
    const category = checklistData[categoryIndex]
    if (!category) return { checked: 0, total: 0, percentage: 0 }

    const total = category.items.length
    let checked = 0

    category.items.forEach((_, itemIndex) => {
      if (isChecked(categoryIndex, itemIndex)) {
        checked++
      }
    })

    return {
      checked,
      total,
      percentage: total > 0 ? Math.round((checked / total) * 100) : 0
    }
  }

  const getTotalProgress = () => {
    let totalChecked = 0
    let totalItems = 0

    checklistData.forEach((category, categoryIndex) => {
      totalItems += category.items.length
      category.items.forEach((_, itemIndex) => {
        if (isChecked(categoryIndex, itemIndex)) {
          totalChecked++
        }
      })
    })

    return {
      checked: totalChecked,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0
    }
  }

  return {
    checkedItems,
    loading,
    saving,
    toggleItem,
    isChecked,
    getCategoryProgress,
    getTotalProgress,
    reload: loadChecklist
  }
}
