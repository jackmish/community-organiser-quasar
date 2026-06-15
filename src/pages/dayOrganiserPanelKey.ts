import type { CSSProperties, InjectionKey, Ref } from "vue";
import type CCAccess from "src/CCAccess";
import type { MediaTaskTypeId } from "src/modules/media/mediaTaskTypes";

export type AddFormDefaultTypeId = "Todo" | "TimeEvent" | "NoteLater" | MediaTaskTypeId;

export type DayOrganiserPanelContext = {
  panelHidden: Ref<boolean>;
  previewFloating: Ref<boolean>;
  previewRect: Ref<DOMRect | null>;
  computePreviewStyle: (rect: DOMRect | null) => CSSProperties;
  filteredParentOptions: Ref<unknown[]>;
  allTasks: Ref<unknown[]>;
  replenishTasks: Ref<unknown[]>;
  newTask: Ref<{ eventDate: string }>;
  animatingLines: Ref<number[]>;
  onLineCollapsed: (...args: unknown[]) => void;
  onLineExpanded: (...args: unknown[]) => void;
  getGroupName: (groupId?: string) => string;
  clearTaskToEdit: () => void;
  handleDeleteTask: (payload: unknown) => void | Promise<void>;
  handleUpdateTask: (task: unknown) => void | Promise<void>;
  handleAddTaskFromForm: (
    taskPayload: unknown,
    opts?: { preview?: boolean },
  ) => void | Promise<void>;
  handleToggleStatus: (payload: unknown) => void | Promise<void>;
  handleCalendarDateSelect: (date: string) => void;
  filterParentTasks: (val: string, update: (fn: () => void) => void) => void;
  /** Default task type when opening the add form. */
  addFormDefaultTypeId: Ref<AddFormDefaultTypeId>;
  /** When true, add form shows Files/Gallery/Link types instead of calendar types. */
  isFilesMode: Ref<boolean>;
  CC: typeof CCAccess;
};

export const dayOrganiserPanelKey: InjectionKey<DayOrganiserPanelContext> =
  Symbol("dayOrganiserPanel");
