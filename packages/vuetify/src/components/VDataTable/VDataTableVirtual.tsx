// Components
import { makeDataTableProps } from './VDataTable'
import { VDataTableHeaders } from './VDataTableHeaders'
import { VDataTableRow } from './VDataTableRow'
import { VDataTableRows } from './VDataTableRows'
import { VTable } from '@/components/VTable'
import { VVirtualScrollItem } from '@/components/VVirtualScroll/VVirtualScrollItem'

// Composables
import { provideExpanded } from './composables/expand'
import { createGroupBy, makeDataTableGroupProps, provideGroupBy, useGroupedItems } from './composables/group'
import { createHeaders } from './composables/headers'
import { useDataTableItems } from './composables/items'
import { useOptions } from './composables/options'
import { provideSelection } from './composables/select'
import { createSort, provideSort, useSortedItems } from './composables/sort'
import { provideDefaults } from '@/composables/defaults'
import { makeFilterProps, useFilter } from '@/composables/filter'
import { makeVirtualProps, useVirtual } from '@/composables/virtual'

// Utilities
import { computed, shallowRef, toRef } from 'vue'
import { convertToUnit, genericComponent, propsFactory, useRender } from '@/util'

// Types
import type { Ref } from 'vue'
import type { VDataTableSlotProps } from './VDataTable'
import type { VDataTableHeadersSlots } from './VDataTableHeaders'
import type { VDataTableRowsSlots } from './VDataTableRows'

type VDataTableVirtualSlotProps = Omit<VDataTableSlotProps, 'setItemsPerPage' | 'page' | 'pageCount' | 'itemsPerPage'>

export type VDataTableVirtualSlots = VDataTableRowsSlots & VDataTableHeadersSlots & {
  top: VDataTableVirtualSlotProps
  headers: VDataTableHeadersSlots['headers']
  bottom: VDataTableVirtualSlotProps
  'body.prepend': VDataTableVirtualSlotProps
  'body.append': VDataTableVirtualSlotProps
  item: {
    itemRef: Ref<HTMLElement | undefined>
  }
}

export const makeVDataTableVirtualProps = propsFactory({
  ...makeDataTableProps(),
  ...makeDataTableGroupProps(),
  ...makeVirtualProps(),
  ...makeFilterProps(),
}, 'VDataTableVirtual')

export const VDataTableVirtual = genericComponent<VDataTableVirtualSlots>()({
  name: 'VDataTableVirtual',

  props: makeVDataTableVirtualProps(),

  emits: {
    'update:modelValue': (value: any[]) => true,
    'update:sortBy': (value: any) => true,
    'update:options': (value: any) => true,
    'update:groupBy': (value: any) => true,
    'update:expanded': (value: any) => true,
  },

  setup (props, { attrs, slots }) {
    const { groupBy } = createGroupBy(props)
    const { sortBy, multiSort, mustSort } = createSort(props)

    const { columns, headers, sortFunctions, filterFunctions } = createHeaders(props, {
      groupBy,
      showSelect: toRef(props, 'showSelect'),
      showExpand: toRef(props, 'showExpand'),
    })
    const { items } = useDataTableItems(props, columns)

    const search = toRef(props, 'search')
    const { filteredItems } = useFilter(props, items, search, {
      transform: item => item.columns,
      customKeyFilter: filterFunctions,
    })

    const { toggleSort } = provideSort({ sortBy, multiSort, mustSort })
    const { sortByWithGroups, opened, extractRows, isGroupOpen, toggleGroup } = provideGroupBy({ groupBy, sortBy })

    const { sortedItems } = useSortedItems(props, filteredItems, sortByWithGroups, sortFunctions)
    const { flatItems } = useGroupedItems(sortedItems, groupBy, opened)

    const allItems = computed(() => extractRows(flatItems.value))

    const { isSelected, select, selectAll, toggleSelect, someSelected, allSelected } = provideSelection(props, {
      allItems,
      currentPage: allItems,
    })
    const { isExpanded, toggleExpand } = provideExpanded(props)

    const {
      containerRef,
      markerRef,
      paddingTop,
      paddingBottom,
      computedItems,
      handleItemResize,
      handleScroll,
      handleScrollend,
    } = useVirtual(props, flatItems)
    const displayItems = computed(() => computedItems.value.map(item => item.raw))

    useOptions({
      sortBy,
      page: shallowRef(1),
      itemsPerPage: shallowRef(-1),
      groupBy,
      search,
    })

    provideDefaults({
      VDataTableRows: {
        hideNoData: toRef(props, 'hideNoData'),
        noDataText: toRef(props, 'noDataText'),
        loading: toRef(props, 'loading'),
        loadingText: toRef(props, 'loadingText'),
      },
    })

    const slotProps = computed<VDataTableVirtualSlotProps>(() => ({
      sortBy: sortBy.value,
      toggleSort,
      someSelected: someSelected.value,
      allSelected: allSelected.value,
      isSelected,
      select,
      selectAll,
      toggleSelect,
      isExpanded,
      toggleExpand,
      isGroupOpen,
      toggleGroup,
      items: allItems.value.map(item => item.raw),
      internalItems: allItems.value,
      groupedItems: flatItems.value,
      columns: columns.value,
      headers: headers.value,
    }))

    useRender(() => {
      const dataTableHeadersProps = VDataTableHeaders.filterProps(props)
      const dataTableRowsProps = VDataTableRows.filterProps(props)
      const tableProps = VTable.filterProps(props)

      return (
        <VTable
          class={[
            'v-data-table',
            {
              'v-data-table--loading': props.loading,
            },
            props.class,
          ]}
          style={ props.style }
          { ...tableProps }
        >
          {{
            top: () => slots.top?.(slotProps.value),
            wrapper: () => (
              <div
                ref={ containerRef }
                onScrollPassive={ handleScroll }
                onScrollend={ handleScrollend }
                class="v-table__wrapper"
                style={{
                  height: convertToUnit(props.height),
                }}
              >
                <table>
                  <thead>
                    <VDataTableHeaders
                      { ...dataTableHeadersProps }
                      sticky={ props.fixedHeader }
                      v-slots={ slots }
                    />
                  </thead>
                  <tbody>
                    <tr ref={ markerRef } style={{ height: convertToUnit(paddingTop.value), border: 0 }}>
                      <td colspan={ columns.value.length } style={{ height: 0, border: 0 }}></td>
                    </tr>

                    { slots['body.prepend']?.(slotProps.value) }

                    <VDataTableRows
                      { ...attrs }
                      { ...dataTableRowsProps }
                      items={ displayItems.value }
                    >
                      {{
                        ...slots,
                        item: itemSlotProps => (
                          <VVirtualScrollItem
                            key={ itemSlotProps.internalItem.index }
                            renderless
                            onUpdate:height={ height => handleItemResize(itemSlotProps.internalItem.index, height) }
                          >
                            { ({ itemRef }) => (
                              slots.item?.({ ...itemSlotProps, itemRef }) ?? (
                                <VDataTableRow
                                  { ...itemSlotProps.props }
                                  ref={ itemRef }
                                  key={ itemSlotProps.internalItem.index }
                                  v-slots={ slots }
                                />
                              )
                            )}
                          </VVirtualScrollItem>
                        ),
                      }}
                    </VDataTableRows>

                    { slots['body.append']?.(slotProps.value) }

                    <tr style={{ height: convertToUnit(paddingBottom.value), border: 0 }}>
                      <td colspan={ columns.value.length } style={{ height: 0, border: 0 }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
            bottom: () => slots.bottom?.(slotProps.value),
          }}
        </VTable>
      )
    })
  },
})

export type VDataTableVirtual = InstanceType<typeof VDataTableVirtual>
