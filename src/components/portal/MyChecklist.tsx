import { useState } from 'react'
import { useChecklist } from '../../hooks/useChecklist'
import { checklistData } from '../../lib/constants'

export function MyChecklist() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const { isChecked, toggleItem, getCategoryProgress, getTotalProgress, loading, saving } = useChecklist()

  const totalProgress = getTotalProgress()

  const toggleCategory = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your checklist...</p>
      </div>
    )
  }

  return (
    <div className="my-checklist">
      <div className="checklist-page-header">
        <div className="header-content">
          <h1>Readiness Checklist</h1>
          <p>Check off each item once you have it ready. Don't upload anything here — keep your documents at home. If you ask to be matched, your professional collects them from you directly.</p>
        </div>
        <div className="overall-progress">
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${totalProgress.percentage}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {totalProgress.checked}/{totalProgress.total} ready ({totalProgress.percentage}%)
            {saving && <span className="saving-indicator"> Saving...</span>}
          </span>
        </div>
      </div>

      <div className="checklist-container">
        {checklistData.map((category, categoryIndex) => {
          const progress = getCategoryProgress(categoryIndex)
          const isOpen = openIndex === categoryIndex

          return (
            <div
              key={categoryIndex}
              className={`checklist-category ${isOpen ? 'open' : ''}`}
            >
              <button
                className="checklist-header"
                onClick={() => toggleCategory(categoryIndex)}
                aria-expanded={isOpen}
                aria-controls={`checklist-content-${categoryIndex}`}
              >
                <span className="checklist-icon" aria-hidden="true">{category.icon}</span>
                <span className="checklist-title">{category.title}</span>
                <span className="category-progress">
                  {progress.checked}/{progress.total}
                </span>
                <span className="checklist-toggle" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              <div
                id={`checklist-content-${categoryIndex}`}
                className="checklist-content"
                role="region"
              >
                <div className="category-progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>
                <ul className="checklist-items">
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <label className="checklist-item">
                        <input
                          type="checkbox"
                          checked={isChecked(categoryIndex, itemIndex)}
                          onChange={() => toggleItem(categoryIndex, itemIndex)}
                        />
                        <span className="checkmark"></span>
                        <span className={`item-text ${isChecked(categoryIndex, itemIndex) ? 'checked' : ''}`}>
                          {item}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <div className="checklist-tip">
        <strong>Tip:</strong> Your progress saves automatically. Keep originals in a safe place, make copies before sending anything, and note the date you sent each item. Never pay anyone upfront for foreclosure help.
      </div>
    </div>
  )
}
