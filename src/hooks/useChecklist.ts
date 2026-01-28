import { useState, useEffect, useCallback } from 'react'
import type { ChecklistProgress } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { checklistData } from '../lib/constants'
import { apiGet, apiPut } from '../lib/api'

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
    try {
      const data = await apiGet<ChecklistProgress[]>('/checklist')
      const newState: ChecklistState = {}
      data.forEach((item) => {
        newState[getKey(item.category_index, item.item_index)] = item.is_checked
      })
      setCheckedItems(newState)
    } catch (err) {
      console.error('Error loading checklist:', err)
    }
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

    try {
      await apiPut('/checklist', {
        category_index: categoryIndex,
        item_index: itemIndex,
        is_checked: newValue
      })
    } catch (err) {
      console.error('Error saving checklist item:', err)
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
