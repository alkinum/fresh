<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    Check,
    Copy as CopyIcon,
    Edit3,
    GripVertical,
    LayoutDashboard,
    LoaderCircle,
    MoreHorizontal,
    Plus,
    Trash2,
    X,
  } from '@lucide/svelte';
  import { onDestroy, tick } from 'svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import {
    contextMenuAtElement,
    contextMenuAtPointer,
    contextMenuReturnFocus,
    type ContextMenuInitialFocus,
    type ContextMenuPlacement,
  } from '$lib/context-menu';
  import { modalFocus } from '$lib/modal-focus';
  import type { KanbanBoardDto, KanbanBoardSummaryDto, KanbanCardDto, KanbanColumnDto } from '$lib/types';

  type KanbanMenuTarget =
    | {
        kind: 'board';
        item: KanbanBoardDto;
      }
    | {
        kind: 'board-tab';
        item: KanbanBoardSummaryDto;
      }
    | {
        kind: 'column';
        item: KanbanColumnDto;
        columnIndex: number;
      }
    | {
        kind: 'card';
        item: KanbanCardDto;
        columnIndex: number;
      };

  interface KanbanMenuCommon {
    placement: ContextMenuPlacement;
    returnFocus: HTMLElement;
    initialFocus: ContextMenuInitialFocus;
  }

  type KanbanMenuState =
    | (KanbanMenuCommon & {
        kind: 'board';
        item: KanbanBoardDto;
      })
    | (KanbanMenuCommon & {
        kind: 'board-tab';
        item: KanbanBoardSummaryDto;
      })
    | (KanbanMenuCommon & {
        kind: 'column';
        item: KanbanColumnDto;
        columnIndex: number;
      })
    | (KanbanMenuCommon & {
        kind: 'card';
        item: KanbanCardDto;
        columnIndex: number;
      });

  const boardColors = ['#5288e8', '#31a279', '#e69a2c', '#df6676', '#8b72d9', '#d65d9e'] as const;
  const boardColorNames = new Map<(typeof boardColors)[number], string>([
    ['#5288e8', 'Blue'],
    ['#31a279', 'Green'],
    ['#e69a2c', 'Amber'],
    ['#df6676', 'Coral'],
    ['#8b72d9', 'Violet'],
    ['#d65d9e', 'Pink'],
  ]);

  let {
    initialBoards,
    activeBoardId,
    createRequest = 0,
    onBoardsChange,
    onSelectBoard,
    onError,
    onSuccess,
  }: {
    initialBoards: KanbanBoardSummaryDto[];
    activeBoardId: string | null;
    createRequest?: number;
    onBoardsChange: (boards: KanbanBoardSummaryDto[]) => void;
    onSelectBoard: (id: string | null) => void;
    onError: (message: string) => void;
    onSuccess: (message: string) => void;
  } = $props();

  let boards = $state<KanbanBoardSummaryDto[]>([]);
  let boardsInitialized = $state(false);
  let board = $state<KanbanBoardDto | null>(null);
  let loadedBoardId = $state<string | null>(null);
  let loading = $state(false);
  let boardLoadError = $state('');
  let menu = $state<KanbanMenuState | null>(null);
  let boardDialogMode = $state<'create' | 'edit' | null>(null);
  let boardName = $state('');
  let boardColor = $state<(typeof boardColors)[number]>(boardColors[0]);
  let boardBusy = $state(false);
  let addingColumn = $state(false);
  let newColumnName = $state('');
  let editingColumnId = $state<string | null>(null);
  let editingColumnName = $state('');
  let columnBusy = $state(false);
  let addingCardColumnId = $state<string | null>(null);
  let newCardTitle = $state('');
  let editingCard = $state<KanbanCardDto | null>(null);
  let cardTitle = $state('');
  let cardDescription = $state('');
  let cardColumnId = $state('');
  let addingCardBusy = $state(false);
  let cardDialogBusy = $state(false);
  let busyCardId = $state<string | null>(null);
  let draggedCardId = $state<string | null>(null);
  let dragTargetColumnId = $state<string | null>(null);
  let handledCreateRequest = $state(0);
  let boardTabsElement = $state<HTMLDivElement | null>(null);
  let newColumnInput = $state<HTMLInputElement>();
  let newCardTextarea = $state<HTMLTextAreaElement>();
  let interactionBoardId: string | null | undefined = undefined;
  let addColumnGeneration = 0;
  let columnEditGeneration = 0;
  let addCardGeneration = 0;
  let boardRevision = 0;
  let boardRequestId = 0;
  let boardRequestBoardId: string | null = null;
  let boardAbortController: AbortController | undefined;

  $effect(() => {
    if (!boardsInitialized) {
      boards = [...initialBoards];
      boardsInitialized = true;
    }
  });

  $effect(() => {
    const id = activeBoardId;
    if (interactionBoardId !== id) {
      interactionBoardId = id;
      menu = null;
      addingColumn = false;
      newColumnName = '';
      editingColumnId = null;
      editingColumnName = '';
      addingCardColumnId = null;
      newCardTitle = '';
      draggedCardId = null;
      dragTargetColumnId = null;
      addColumnGeneration += 1;
      columnEditGeneration += 1;
      addCardGeneration += 1;
    }
    if (!id) {
      boardAbortController?.abort();
      boardRequestId += 1;
      boardRequestBoardId = null;
      board = null;
      loadedBoardId = null;
      loading = false;
      boardLoadError = '';
      return;
    }
    if (loadedBoardId !== id) {
      loadedBoardId = id;
      void loadBoard(id);
    } else if (boardRequestBoardId && boardRequestBoardId !== id) {
      boardAbortController?.abort();
      boardRequestId += 1;
      boardRequestBoardId = null;
      loading = false;
    }
  });

  $effect(() => {
    if (createRequest > handledCreateRequest) {
      handledCreateRequest = createRequest;
      openBoardDialog();
    }
  });

  $effect(() => {
    const id = activeBoardId;
    const tabs = boardTabsElement;
    if (!id || !tabs) return;

    const timeout = window.setTimeout(() => {
      const activeTab = [...tabs.querySelectorAll<HTMLElement>('[data-board-id]')].find(
        (item) => item.dataset.boardId === id,
      );
      activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 0);

    return () => window.clearTimeout(timeout);
  });

  function setBoards(next: KanbanBoardSummaryDto[]): void {
    boards = next;
    onBoardsChange(next);
  }

  function toSummary(value: KanbanBoardDto): KanbanBoardSummaryDto {
    return {
      id: value.id,
      name: value.name,
      color: value.color,
      position: value.position,
      columnCount: value.columnCount,
      cardCount: value.cardCount,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  function syncBoard(value: KanbanBoardDto): void {
    boardRevision += 1;
    board = value;
    const summary = toSummary(value);
    const index = boards.findIndex((item) => item.id === value.id);
    if (index >= 0) setBoards(boards.map((item) => (item.id === value.id ? summary : item)));
    else setBoards([...boards, summary]);
  }

  function updateBoardSummary(
    id: string,
    update: (summary: KanbanBoardSummaryDto) => KanbanBoardSummaryDto,
  ): void {
    setBoards(boards.map((item) => (item.id === id ? update(item) : item)));
  }

  async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  function menuKey(target: KanbanMenuTarget | KanbanMenuState): string {
    return `${target.kind}:${target.item.id}`;
  }

  function showMenu(
    target: KanbanMenuTarget,
    placement: ContextMenuPlacement,
    returnFocus: HTMLElement,
    initialFocus: ContextMenuInitialFocus = 'first',
  ): void {
    menu = { ...target, placement, returnFocus, initialFocus } as KanbanMenuState;
  }

  function toggleMenuFromButton(event: MouseEvent, target: KanbanMenuTarget): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    if (menu && menuKey(menu) === menuKey(target)) {
      menu = null;
      return;
    }
    showMenu(target, contextMenuAtElement(button), button);
  }

  function openMenuFromKeyboard(event: KeyboardEvent, target: KanbanMenuTarget): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    showMenu(target, contextMenuAtElement(button), button, event.key === 'ArrowUp' ? 'last' : 'first');
  }

  function openItemContextMenu(event: MouseEvent, target: KanbanMenuTarget): void {
    const surface = event.currentTarget;
    const eventTarget = event.target;
    if (!(surface instanceof HTMLElement) || !(eventTarget instanceof Element)) return;

    event.stopPropagation();
    const selection = window.getSelection()?.toString();
    const keepsNativeMenu = eventTarget.closest('a, input, textarea, select');
    if (selection || keepsNativeMenu) return;

    event.preventDefault();
    const menuButton =
      target.kind === 'board-tab'
        ? surface
        : target.kind === 'board'
          ? (surface.querySelector<HTMLElement>(':scope > .menu-wrap > button') ?? surface)
          : target.kind === 'column'
            ? (surface.querySelector<HTMLElement>(':scope > header .menu-wrap > button') ?? surface)
            : (surface.querySelector<HTMLElement>(':scope .kanban-card-topline .menu-wrap > button') ?? surface);
    showMenu(target, contextMenuAtPointer(event, surface), contextMenuReturnFocus(menuButton));
  }

  function openCurrentBoardContextMenu(event: MouseEvent): void {
    if (board) openItemContextMenu(event, { kind: 'board', item: board });
  }

  function toggleCurrentBoardMenu(event: MouseEvent): void {
    if (board) toggleMenuFromButton(event, { kind: 'board', item: board });
  }

  function openCurrentBoardMenuFromKeyboard(event: KeyboardEvent): void {
    if (board) openMenuFromKeyboard(event, { kind: 'board', item: board });
  }

  function openBoardFromMenu(): void {
    if (menu?.kind !== 'board-tab') return;
    const id = menu.item.id;
    menu = null;
    onSelectBoard(id);
  }

  async function copyBoardNameFromMenu(): Promise<void> {
    if (menu?.kind !== 'board-tab') return;
    const name = menu.item.name;
    menu = null;
    try {
      await navigator.clipboard.writeText(name);
      onSuccess('Board name copied');
    } catch {
      onError('Could not copy board name');
    }
  }

  function editBoardFromMenu(): void {
    if (menu?.kind === 'board') {
      openBoardDialog(menu.item);
    } else if (menu?.kind === 'board-tab' && board?.id === menu.item.id) {
      openBoardDialog(board);
    }
  }

  function addCardFromMenu(): void {
    if (menu?.kind === 'column') openAddCard(menu.item.id);
  }

  function renameColumnFromMenu(): void {
    if (menu?.kind === 'column') startColumnEdit(menu.item);
  }

  function deleteColumnFromMenu(): void {
    if (menu?.kind !== 'column') return;
    const column = menu.item;
    menu = null;
    void deleteColumn(column);
  }

  function moveCardFromMenu(direction: -1 | 1): void {
    if (menu?.kind === 'card') moveSideways(menu.item, direction);
  }

  function editCardFromMenu(): void {
    if (menu?.kind === 'card') openCardDialog(menu.item);
  }

  function deleteCardFromMenu(): void {
    if (menu?.kind !== 'card') return;
    const card = menu.item;
    menu = null;
    void deleteCard(card);
  }

  function canMoveMenuCard(direction: -1 | 1): boolean {
    if (menu?.kind !== 'card' || !board) return false;
    const targetIndex = menu.columnIndex + direction;
    return targetIndex >= 0 && targetIndex < board.columns.length;
  }

  async function loadBoard(id: string, showLoading = true): Promise<boolean> {
    boardAbortController?.abort();
    const controller = new AbortController();
    const requestId = ++boardRequestId;
    boardAbortController = controller;
    boardRequestBoardId = id;
    loading = showLoading;
    boardLoadError = '';
    try {
      const response = await fetch(`/api/kanban/boards/${id}`, { signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response));
      if (requestId !== boardRequestId || activeBoardId !== id) return false;
      syncBoard((await response.json()) as KanbanBoardDto);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false;
      if (requestId === boardRequestId && activeBoardId === id) {
        boardLoadError = error instanceof Error ? error.message : 'Could not load board';
        onError(boardLoadError);
      }
      return false;
    } finally {
      if (requestId === boardRequestId) {
        loading = false;
        boardAbortController = undefined;
        boardRequestBoardId = null;
      }
    }
  }

  onDestroy(() => boardAbortController?.abort());

  function openBoardDialog(value?: KanbanBoardDto): void {
    menu = null;
    boardDialogMode = value ? 'edit' : 'create';
    boardName = value?.name ?? '';
    const nextColor = value?.color as (typeof boardColors)[number] | undefined;
    boardColor = nextColor && boardColors.includes(nextColor) ? nextColor : boardColors[0];
  }

  function closeBoardDialog(): void {
    if (boardBusy) return;
    boardDialogMode = null;
    boardName = '';
  }

  async function saveBoard(): Promise<void> {
    const name = boardName.trim();
    if (!name || boardBusy) return;
    boardBusy = true;
    try {
      const editing = boardDialogMode === 'edit' && board;
      const response = await fetch(editing ? `/api/kanban/boards/${editing.id}` : '/api/kanban/boards', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, color: boardColor }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const saved = (await response.json()) as KanbanBoardDto;
      syncBoard(saved);
      loadedBoardId = saved.id;
      boardDialogMode = null;
      onSelectBoard(saved.id);
      onSuccess(editing ? 'Board updated' : 'Board created');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save board');
    } finally {
      boardBusy = false;
    }
  }

  async function deleteBoard(): Promise<void> {
    if (!board || !confirm(`Delete “${board.name}” and all its cards?`)) return;
    const deletingId = board.id;
    menu = null;
    try {
      const response = await fetch(`/api/kanban/boards/${deletingId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      const index = boards.findIndex((item) => item.id === deletingId);
      const nextBoards = boards.filter((item) => item.id !== deletingId);
      const nextBoard = nextBoards[Math.min(index, Math.max(0, nextBoards.length - 1))] ?? null;
      setBoards(nextBoards);
      if (activeBoardId === deletingId) {
        boardAbortController?.abort();
        boardRequestId += 1;
        board = null;
        loadedBoardId = null;
        loading = false;
        boardLoadError = '';
        onSelectBoard(nextBoard?.id ?? null);
      } else if (board?.id === deletingId) {
        board = null;
      }
      onSuccess('Board deleted');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete board');
    }
  }

  async function addColumn(): Promise<void> {
    if (!board || !newColumnName.trim() || columnBusy) return;
    const boardId = board.id;
    const name = newColumnName.trim();
    const generation = addColumnGeneration;
    columnBusy = true;
    try {
      const response = await fetch(`/api/kanban/boards/${boardId}/columns`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const column = (await response.json()) as KanbanColumnDto;
      if (board?.id === boardId && !board.columns.some((item) => item.id === column.id)) {
        syncBoard({
          ...board,
          columnCount: board.columnCount + 1,
          columns: [...board.columns, column],
        });
      } else if (board?.id !== boardId) {
        updateBoardSummary(boardId, (summary) => ({
          ...summary,
          columnCount: summary.columnCount + 1,
          updatedAt: column.updatedAt,
        }));
      }
      if (generation === addColumnGeneration) {
        newColumnName = '';
        addingColumn = false;
      }
      onSuccess('Column added');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not add column');
    } finally {
      columnBusy = false;
    }
  }

  function startColumnEdit(column: KanbanColumnDto): void {
    menu = null;
    columnEditGeneration += 1;
    editingColumnId = column.id;
    editingColumnName = column.name;
    const generation = columnEditGeneration;
    void tick().then(() => {
      if (generation === columnEditGeneration && editingColumnId === column.id) {
        document.querySelector<HTMLInputElement>(`[data-column-name="${CSS.escape(column.id)}"]`)?.focus();
      }
    });
  }

  async function saveColumn(column: KanbanColumnDto): Promise<void> {
    if (!board || !editingColumnName.trim() || columnBusy) return;
    const boardId = column.boardId;
    const name = editingColumnName.trim();
    const generation = columnEditGeneration;
    columnBusy = true;
    try {
      const response = await fetch(`/api/kanban/columns/${column.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = (await response.json()) as KanbanColumnDto;
      if (board?.id === boardId) {
        syncBoard({
          ...board,
          columns: board.columns.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        });
      } else {
        updateBoardSummary(boardId, (summary) => ({ ...summary, updatedAt: updated.updatedAt }));
      }
      if (generation === columnEditGeneration) editingColumnId = null;
      onSuccess('Column renamed');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not rename column');
    } finally {
      columnBusy = false;
    }
  }

  async function deleteColumn(column: KanbanColumnDto): Promise<void> {
    if (!board || !confirm(`Delete “${column.name}” and its ${column.cards.length} cards?`)) return;
    const boardId = column.boardId;
    const removedCardCount = column.cards.length;
    menu = null;
    try {
      const response = await fetch(`/api/kanban/columns/${column.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      if (board?.id === boardId) {
        const currentColumn = board.columns.find((item) => item.id === column.id);
        if (currentColumn) {
          syncBoard({
            ...board,
            columnCount: Math.max(0, board.columnCount - 1),
            cardCount: Math.max(0, board.cardCount - currentColumn.cards.length),
            columns: board.columns.filter((item) => item.id !== column.id),
          });
        }
      } else {
        updateBoardSummary(boardId, (summary) => ({
          ...summary,
          columnCount: Math.max(0, summary.columnCount - 1),
          cardCount: Math.max(0, summary.cardCount - removedCardCount),
        }));
      }
      onSuccess('Column deleted');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete column');
    }
  }

  function openAddCard(columnId: string): void {
    addCardGeneration += 1;
    addingCardColumnId = columnId;
    newCardTitle = '';
    menu = null;
    const generation = addCardGeneration;
    void tick().then(() => {
      if (generation === addCardGeneration && addingCardColumnId === columnId) newCardTextarea?.focus();
    });
  }

  async function addCard(column: KanbanColumnDto): Promise<void> {
    if (!board || !newCardTitle.trim() || addingCardBusy) return;
    const boardId = column.boardId;
    const title = newCardTitle.trim();
    const generation = addCardGeneration;
    addingCardBusy = true;
    try {
      const response = await fetch(`/api/kanban/columns/${column.id}/cards`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const card = (await response.json()) as KanbanCardDto;
      if (board?.id === boardId && !board.columns.some((item) => item.cards.some((value) => value.id === card.id))) {
        syncBoard({
          ...board,
          cardCount: board.cardCount + 1,
          columns: board.columns.map((item) =>
            item.id === column.id ? { ...item, cards: [...item.cards, card] } : item,
          ),
        });
      } else if (board?.id !== boardId) {
        updateBoardSummary(boardId, (summary) => ({
          ...summary,
          cardCount: summary.cardCount + 1,
          updatedAt: card.updatedAt,
        }));
      }
      if (generation === addCardGeneration) {
        addingCardColumnId = null;
        newCardTitle = '';
      }
      onSuccess('Card added');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not add card');
    } finally {
      addingCardBusy = false;
    }
  }

  function openCardDialog(card: KanbanCardDto): void {
    menu = null;
    editingCard = card;
    cardTitle = card.title;
    cardDescription = card.description;
    cardColumnId = card.columnId;
  }

  function closeCardDialog(): void {
    if (cardDialogBusy) return;
    editingCard = null;
  }

  async function saveCard(): Promise<void> {
    if (!board || !editingCard || !cardTitle.trim() || cardDialogBusy) return;
    const boardId = board.id;
    const card = editingCard;
    const nextColumnId = cardColumnId;
    const nextTitle = cardTitle.trim();
    const nextDescription = cardDescription.trim();
    cardDialogBusy = true;
    try {
      const targetColumn = board.columns.find((column) => column.id === nextColumnId);
      if (!targetColumn) throw new Error('Column not found');
      const moving = card.columnId !== nextColumnId;
      const response = await fetch(`/api/kanban/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: nextTitle,
          description: nextDescription,
          ...(moving ? { columnId: nextColumnId, position: targetColumn.cards.length } : {}),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      editingCard = null;
      if (activeBoardId === boardId && !await loadBoard(boardId, false)) return;
      onSuccess('Card updated');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update card');
    } finally {
      cardDialogBusy = false;
    }
  }

  async function deleteCard(card: KanbanCardDto): Promise<void> {
    if (!board || !confirm(`Delete “${card.title}”?`)) return;
    const boardId = card.boardId;
    menu = null;
    try {
      const response = await fetch(`/api/kanban/cards/${card.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      if (board?.id === boardId) {
        const containsCard = board.columns.some((column) => column.cards.some((item) => item.id === card.id));
        if (containsCard) {
          syncBoard({
            ...board,
            cardCount: Math.max(0, board.cardCount - 1),
            columns: board.columns.map((column) => ({
              ...column,
              cards: column.cards.filter((item) => item.id !== card.id).map((item, position) => ({ ...item, position })),
            })),
          });
        }
      } else {
        updateBoardSummary(boardId, (summary) => ({
          ...summary,
          cardCount: Math.max(0, summary.cardCount - 1),
        }));
      }
      if (editingCard?.id === card.id) editingCard = null;
      onSuccess('Card deleted');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not delete card');
    }
  }

  function movedBoard(card: KanbanCardDto, targetColumnId: string, targetPosition: number): KanbanBoardDto | null {
    if (!board) return null;
    const sourceColumn = board.columns.find((column) => column.id === card.columnId);
    const targetColumn = board.columns.find((column) => column.id === targetColumnId);
    if (!sourceColumn || !targetColumn) return null;

    const columns = board.columns.map((column) => {
      const withoutCard = column.cards.filter((item) => item.id !== card.id);
      if (column.id !== targetColumnId) {
        return { ...column, cards: withoutCard.map((item, position) => ({ ...item, position })) };
      }
      const nextCards = [...withoutCard];
      nextCards.splice(Math.min(Math.max(targetPosition, 0), nextCards.length), 0, {
        ...card,
        columnId: targetColumnId,
      });
      return { ...column, cards: nextCards.map((item, position) => ({ ...item, position })) };
    });
    return { ...board, columns };
  }

  async function moveCard(card: KanbanCardDto, targetColumnId: string, targetPosition: number): Promise<void> {
    if (!board || busyCardId) return;
    const boardId = board.id;
    const sourcePosition = board.columns
      .find((column) => column.id === card.columnId)
      ?.cards.findIndex((item) => item.id === card.id);
    if (card.columnId === targetColumnId && sourcePosition === targetPosition) return;

    const previous = board;
    const optimistic = movedBoard(card, targetColumnId, targetPosition);
    if (!optimistic) return;
    busyCardId = card.id;
    syncBoard(optimistic);
    const optimisticRevision = boardRevision;
    try {
      const response = await fetch(`/api/kanban/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: targetColumnId, position: targetPosition }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = (await response.json()) as KanbanCardDto;
      if (board?.id === boardId && boardRevision === optimisticRevision) {
        syncBoard({
          ...board,
          columns: board.columns.map((column) => ({
            ...column,
            cards: column.cards.map((item) => (item.id === updated.id ? updated : item)),
          })),
        });
      } else if (activeBoardId === boardId) {
        await loadBoard(boardId, false);
      } else {
        updateBoardSummary(boardId, (summary) => ({ ...summary, updatedAt: updated.updatedAt }));
      }
    } catch (error) {
      if (board?.id === boardId && activeBoardId === boardId && boardRevision === optimisticRevision) {
        syncBoard(previous);
      }
      onError(error instanceof Error ? error.message : 'Could not move card');
    } finally {
      if (busyCardId === card.id) busyCardId = null;
    }
  }

  function beginDrag(event: DragEvent, card: KanbanCardDto): void {
    if (busyCardId) return;
    draggedCardId = card.id;
    event.dataTransfer?.setData('text/plain', card.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function allowDrop(event: DragEvent, columnId: string): void {
    event.preventDefault();
    dragTargetColumnId = columnId;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function dropCard(event: DragEvent, column: KanbanColumnDto): void {
    event.preventDefault();
    const cardId = draggedCardId ?? event.dataTransfer?.getData('text/plain');
    const card = board?.columns.flatMap((item) => item.cards).find((item) => item.id === cardId);
    if (!card) return endDrag();

    let position = column.cards.length;
    const targetElement = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-kanban-card]');
    if (targetElement?.dataset.kanbanCard) {
      const targetIndex = column.cards.findIndex((item) => item.id === targetElement.dataset.kanbanCard);
      if (targetIndex >= 0) {
        const bounds = targetElement.getBoundingClientRect();
        position = targetIndex + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
      }
    }
    const sourceIndex = column.id === card.columnId ? column.cards.findIndex((item) => item.id === card.id) : -1;
    if (sourceIndex >= 0 && sourceIndex < position) position -= 1;
    endDrag();
    void moveCard(card, column.id, position);
  }

  function endDrag(): void {
    draggedCardId = null;
    dragTargetColumnId = null;
  }

  function moveSideways(card: KanbanCardDto, direction: -1 | 1): void {
    if (!board) return;
    menu = null;
    const currentIndex = board.columns.findIndex((column) => column.id === card.columnId);
    const target = board.columns[currentIndex + direction];
    if (target) void moveCard(card, target.id, target.cards.length);
  }

  function dateLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  }

  function handleBoardTabKeydown(event: KeyboardEvent, index: number): void {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % boards.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + boards.length) % boards.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = boards.length - 1;
    if (nextIndex === undefined || !boards[nextIndex]) return;

    event.preventDefault();
    const nextBoard = boards[nextIndex];
    onSelectBoard(nextBoard.id);
    requestAnimationFrame(() => {
      boardTabsElement
        ?.querySelector<HTMLElement>(`[data-board-id="${CSS.escape(nextBoard.id)}"]`)
        ?.focus();
    });
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (editingCard) closeCardDialog();
    else if (boardDialogMode) closeBoardDialog();
    else {
      menu = null;
      addingColumn = false;
      addColumnGeneration += 1;
      addingCardColumnId = null;
      addCardGeneration += 1;
      editingColumnId = null;
      columnEditGeneration += 1;
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section class="kanban-workspace" aria-label="Kanban workspace" aria-busy={loading}>
  <div class="board-switcher-row">
    <div bind:this={boardTabsElement} class="board-tabs" role="tablist" aria-label="Kanban boards">
      {#each boards as item, index (item.id)}
        <button
          type="button"
          role="tab"
          data-board-id={item.id}
          id={`board-tab-${item.id}`}
          aria-controls={`board-panel-${item.id}`}
          aria-selected={activeBoardId === item.id}
          tabindex={activeBoardId === item.id ? 0 : -1}
          class:active={activeBoardId === item.id}
          style={`--board-color: ${item.color}`}
          onclick={() => onSelectBoard(item.id)}
          onkeydown={(event) => handleBoardTabKeydown(event, index)}
          oncontextmenu={(event) => openItemContextMenu(event, { kind: 'board-tab', item })}
        >
          <span class="board-tab-dot" aria-hidden="true"></span>
          <span>{item.name}</span>
          <small aria-label={`${item.cardCount} ${item.cardCount === 1 ? 'card' : 'cards'}`}>{item.cardCount}</small>
        </button>
      {/each}
    </div>
    <button
      class="icon-button board-add-button"
      aria-label="Create board"
      title="Create board"
      onclick={() => openBoardDialog()}
    >
      <Plus size={18} />
    </button>
  </div>

  {#if loading}
    <div class="kanban-loading" role="status"><LoaderCircle class="spin" size={20} /> Loading board...</div>
  {:else if boardLoadError && activeBoardId}
    <div class="kanban-loading kanban-load-error" role="alert">
      <span>{boardLoadError}</span>
      <button class="primary-button" onclick={() => void loadBoard(activeBoardId)}>Retry</button>
    </div>
  {:else if board && activeBoardId === board.id}
    <div
      id={`board-panel-${board.id}`}
      class="kanban-board-panel"
      role="tabpanel"
      aria-labelledby={`board-tab-${board.id}`}
      tabindex="0"
    >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header
      class="kanban-board-header"
      style={`--board-color: ${board.color}`}
      oncontextmenu={openCurrentBoardContextMenu}
    >
      <div class="kanban-board-title">
        <span aria-hidden="true"></span>
        <div>
          <h1>{board.name}</h1>
          <p>
            {board.cardCount}
            {board.cardCount === 1 ? 'card' : 'cards'} · {board.columnCount}
            {board.columnCount === 1 ? 'column' : 'columns'}
          </p>
        </div>
      </div>
      <div class="menu-wrap">
        <button
          class="icon-button"
          aria-label="Board actions"
          aria-haspopup="menu"
          aria-expanded={menu?.kind === 'board' && menu.item.id === board.id}
          aria-controls={menu?.kind === 'board' && menu.item.id === board.id
            ? `kanban-board-menu-${board.id}`
            : undefined}
          title="Board actions"
          onclick={toggleCurrentBoardMenu}
          onkeydown={openCurrentBoardMenuFromKeyboard}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>

    <div class="kanban-columns" role="region" aria-label={`${board.name} columns`}>
      {#each board.columns as column, columnIndex (column.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <section
          class="kanban-column"
          style={`--board-color: ${board.color}`}
          oncontextmenu={(event) => openItemContextMenu(event, { kind: 'column', item: column, columnIndex })}
        >
          <header>
            {#if editingColumnId === column.id}
              <form
                class="column-name-form"
                aria-busy={columnBusy}
                onsubmit={(event) => {
                  event.preventDefault();
                  void saveColumn(column);
                }}
              >
                <input
                  data-column-name={column.id}
                  bind:value={editingColumnName}
                  maxlength="60"
                  aria-label="Column name"
                  required
                />
                <button
                  class="icon-button"
                  type="submit"
                  aria-label="Save column name"
                  title="Save"
                  disabled={columnBusy}
                >
                  {#if columnBusy}<LoaderCircle class="spin" size={15} />{:else}<Check size={15} />{/if}
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Cancel rename"
                  title="Cancel"
                  onclick={() => {
                    editingColumnId = null;
                    columnEditGeneration += 1;
                  }}
                >
                  <X size={15} />
                </button>
              </form>
            {:else}
              <div class="kanban-column-title">
                <span aria-hidden="true"></span>
                <h2>{column.name}</h2>
                <small>{column.cards.length}</small>
              </div>
              <div class="menu-wrap">
                <button
                  class="icon-button"
                  aria-label={`${column.name} actions`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.kind === 'column' && menu.item.id === column.id}
                  aria-controls={menu?.kind === 'column' && menu.item.id === column.id
                    ? `kanban-column-menu-${column.id}`
                    : undefined}
                  title="Column actions"
                  onclick={(event) => toggleMenuFromButton(event, { kind: 'column', item: column, columnIndex })}
                  onkeydown={(event) => openMenuFromKeyboard(event, { kind: 'column', item: column, columnIndex })}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            {/if}
          </header>

          <div
            class:drag-target={dragTargetColumnId === column.id}
            class="kanban-card-list"
            role="list"
            ondragover={(event) => allowDrop(event, column.id)}
            ondrop={(event) => dropCard(event, column)}
          >
            {#each column.cards as card (card.id)}
              <article
                class:dragging={draggedCardId === card.id}
                class:busy={busyCardId === card.id}
                class="kanban-card"
                data-kanban-card={card.id}
                role="listitem"
                draggable={busyCardId === null}
                ondragstart={(event) => beginDrag(event, card)}
                ondragend={endDrag}
                oncontextmenu={(event) => openItemContextMenu(event, { kind: 'card', item: card, columnIndex })}
              >
                <div class="kanban-card-topline">
                  <GripVertical class="kanban-drag-handle" size={15} aria-hidden="true" />
                  <button class="kanban-card-open" onclick={() => openCardDialog(card)}>{card.title}</button>
                  <div class="menu-wrap">
                    <button
                      class="icon-button"
                      aria-label={`${card.title} actions`}
                      aria-haspopup="menu"
                      aria-expanded={menu?.kind === 'card' && menu.item.id === card.id}
                      aria-controls={menu?.kind === 'card' && menu.item.id === card.id
                        ? `kanban-card-menu-${card.id}`
                        : undefined}
                      title="Card actions"
                      disabled={busyCardId === card.id}
                      onclick={(event) => toggleMenuFromButton(event, { kind: 'card', item: card, columnIndex })}
                      onkeydown={(event) => openMenuFromKeyboard(event, { kind: 'card', item: card, columnIndex })}
                    >
                      {#if busyCardId === card.id}<LoaderCircle class="spin" size={14} />{:else}<MoreHorizontal
                          size={16}
                        />{/if}
                    </button>
                  </div>
                </div>
                {#if card.description}
                  <p>{card.description}</p>
                {/if}
                <footer><time datetime={card.updatedAt}>{dateLabel(card.updatedAt)}</time></footer>
              </article>
            {/each}
          </div>

          {#if addingCardColumnId === column.id}
            <form
              class="kanban-add-card-form"
              aria-busy={addingCardBusy}
              onsubmit={(event) => {
                event.preventDefault();
                void addCard(column);
              }}
            >
              <textarea
                bind:this={newCardTextarea}
                bind:value={newCardTitle}
                maxlength="200"
                rows="3"
                placeholder="Card title"
                aria-label="Card title"
                required></textarea>
              <div>
                <button class="primary-button" type="submit" disabled={addingCardBusy}>
                  {#if addingCardBusy}<LoaderCircle class="spin" size={14} />{:else}<Plus size={14} />{/if}
                  Add card
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Cancel new card"
                  title="Cancel"
                  onclick={() => {
                    addingCardColumnId = null;
                    addCardGeneration += 1;
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </form>
          {:else}
            <button class="kanban-add-card" onclick={() => openAddCard(column.id)}><Plus size={15} /> Add card</button>
          {/if}
        </section>
      {/each}

      <section class="kanban-column kanban-new-column">
        {#if addingColumn}
          <form
            aria-busy={columnBusy}
            onsubmit={(event) => {
              event.preventDefault();
              void addColumn();
            }}
          >
            <input
              bind:this={newColumnInput}
              bind:value={newColumnName}
              maxlength="60"
              placeholder="Column name"
              aria-label="Column name"
              required
            />
            <div>
              <button class="primary-button" type="submit" disabled={columnBusy}>
                {#if columnBusy}<LoaderCircle class="spin" size={14} />{:else}<Plus size={14} />{/if}
                Add column
              </button>
              <button
                class="icon-button"
                type="button"
                aria-label="Cancel new column"
                title="Cancel"
                onclick={() => {
                  addingColumn = false;
                  addColumnGeneration += 1;
                }}
              >
                <X size={16} />
              </button>
            </div>
          </form>
        {:else}
          <button
            onclick={() => {
              addColumnGeneration += 1;
              addingColumn = true;
              newColumnName = '';
              const generation = addColumnGeneration;
              void tick().then(() => {
                if (generation === addColumnGeneration && addingColumn) newColumnInput?.focus();
              });
            }}><Plus size={17} /> Add column</button
          >
        {/if}
      </section>
    </div>
    </div>
  {:else}
    <div class="empty-state kanban-empty">
      <div class="empty-glyph"><LayoutDashboard size={22} /></div>
      <h2>Create your first board</h2>
      <button class="primary-button" onclick={() => openBoardDialog()}><Plus size={15} /> New board</button>
    </div>
  {/if}
</section>

{#if menu}
  <ContextMenu
    id={`kanban-${menu.kind}-menu-${menu.item.id}`}
    label={menu.kind === 'card' ? `Actions for ${menu.item.title}` : `Actions for ${menu.item.name}`}
    placement={menu.placement}
    returnFocus={menu.returnFocus}
    initialFocus={menu.initialFocus}
    onClose={() => (menu = null)}
  >
    {#if menu.kind === 'board-tab'}
      <button role="menuitem" tabindex="-1" onclick={openBoardFromMenu}>
        <LayoutDashboard size={15} aria-hidden="true" />
        <span>Open board</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={() => void copyBoardNameFromMenu()}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>Copy board name</span>
      </button>
      {#if board?.id === menu.item.id}
        <div role="separator"></div>
        <button role="menuitem" tabindex="-1" onclick={editBoardFromMenu}>
          <Edit3 size={15} aria-hidden="true" />
          <span>Edit board</span>
        </button>
        <button class="danger" role="menuitem" tabindex="-1" onclick={() => void deleteBoard()}>
          <Trash2 size={15} aria-hidden="true" />
          <span>Delete board</span>
        </button>
      {/if}
    {:else if menu.kind === 'board'}
      <button role="menuitem" tabindex="-1" onclick={editBoardFromMenu}>
        <Edit3 size={15} aria-hidden="true" />
        <span>Edit board</span>
      </button>
      <button class="danger" role="menuitem" tabindex="-1" onclick={() => void deleteBoard()}>
        <Trash2 size={15} aria-hidden="true" />
        <span>Delete board</span>
      </button>
    {:else if menu.kind === 'column'}
      <button role="menuitem" tabindex="-1" onclick={addCardFromMenu}>
        <Plus size={15} aria-hidden="true" />
        <span>Add card</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={renameColumnFromMenu}>
        <Edit3 size={15} aria-hidden="true" />
        <span>Rename</span>
      </button>
      <div role="separator"></div>
      <button class="danger" role="menuitem" tabindex="-1" onclick={deleteColumnFromMenu}>
        <Trash2 size={15} aria-hidden="true" />
        <span>Delete</span>
      </button>
    {:else}
      <button role="menuitem" tabindex="-1" disabled={!canMoveMenuCard(-1)} onclick={() => moveCardFromMenu(-1)}>
        <ArrowLeft size={15} aria-hidden="true" />
        <span>Move left</span>
      </button>
      <button role="menuitem" tabindex="-1" disabled={!canMoveMenuCard(1)} onclick={() => moveCardFromMenu(1)}>
        <ArrowRight size={15} aria-hidden="true" />
        <span>Move right</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={editCardFromMenu}>
        <Edit3 size={15} aria-hidden="true" />
        <span>Edit</span>
      </button>
      <div role="separator"></div>
      <button class="danger" role="menuitem" tabindex="-1" onclick={deleteCardFromMenu}>
        <Trash2 size={15} aria-hidden="true" />
        <span>Delete</span>
      </button>
    {/if}
  </ContextMenu>
{/if}

{#if boardDialogMode}
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Close board dialog" onclick={closeBoardDialog}></button>
    <div
      use:modalFocus={{ onDismiss: closeBoardDialog }}
      class="dialog kanban-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-dialog-title"
      aria-busy={boardBusy}
    >
      <header>
        <div class="dialog-title">
          <LayoutDashboard size={19} />
          <h2 id="board-dialog-title">{boardDialogMode === 'create' ? 'New board' : 'Edit board'}</h2>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" onclick={closeBoardDialog}><X size={18} /></button>
      </header>
      <form
        class="dialog-form"
        onsubmit={(event) => {
          event.preventDefault();
          void saveBoard();
        }}
      >
        <label>
          <span>Board name</span>
          <input data-dialog-initial-focus bind:value={boardName} maxlength="80" placeholder="Product launch" required />
        </label>
        <fieldset class="board-color-field">
          <legend>Board color</legend>
          <div class="board-color-swatches">
            {#each boardColors as color (color)}
              <button
                type="button"
                class:active={boardColor === color}
                style={`--swatch-color: ${color}`}
                aria-label={`Choose ${boardColorNames.get(color) ?? color}`}
                aria-pressed={boardColor === color}
                onclick={() => (boardColor = color)}
              >
                {#if boardColor === color}<Check size={15} />{/if}
              </button>
            {/each}
          </div>
        </fieldset>
        <button type="submit" class="primary-button wide" disabled={boardBusy}>
          {#if boardBusy}<LoaderCircle class="spin" size={16} />{:else}<Check size={16} />{/if}
          {boardDialogMode === 'create' ? 'Create board' : 'Save changes'}
        </button>
      </form>
    </div>
  </div>
{/if}

{#if editingCard && board}
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Close card dialog" onclick={closeCardDialog}></button>
    <div
      use:modalFocus={{ onDismiss: closeCardDialog }}
      class="dialog kanban-dialog card-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-dialog-title"
      aria-busy={cardDialogBusy}
    >
      <header>
        <div class="dialog-title">
          <Edit3 size={19} />
          <h2 id="card-dialog-title">Edit card</h2>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" onclick={closeCardDialog}><X size={18} /></button>
      </header>
      <form
        class="dialog-form"
        onsubmit={(event) => {
          event.preventDefault();
          void saveCard();
        }}
      >
        <label>
          <span>Title</span>
          <input data-dialog-initial-focus bind:value={cardTitle} maxlength="200" required />
        </label>
        <label>
          <span>Description</span>
          <textarea bind:value={cardDescription} maxlength="10000" rows="7" placeholder="Optional details"></textarea>
        </label>
        <label>
          <span>Column</span>
          <select bind:value={cardColumnId}>
            {#each board.columns as column (column.id)}
              <option value={column.id}>{column.name}</option>
            {/each}
          </select>
        </label>
        <button type="submit" class="primary-button wide" disabled={cardDialogBusy}>
          {#if cardDialogBusy}<LoaderCircle class="spin" size={16} />{:else}<Check size={16} />{/if}
          Save card
        </button>
      </form>
    </div>
  </div>
{/if}
