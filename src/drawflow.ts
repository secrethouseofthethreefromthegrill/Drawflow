import "./drawflow.css";

function getNodeID(str: string) {
  return str.slice(5);
}

function getConnectionData(classList: DOMTokenList): DrawflowConnection {
  return {
    output_id: classList[2].slice(14),
    input_id: classList[1].slice(13),
    output_class: classList[3],
    input_class: classList[4],
  };
}

function insertObjectkeys(
  content: HTMLElement,
  obj: unknown,
  keys: string[] = []
) {
  if (obj === null || typeof obj !== "object") return;

  for (const key in obj) {
    if (Object.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === "object" && value !== null) {
        insertObjectkeys(content, value as Record<string, unknown>, [key]);
      } else {
        const completeKey = keys.concat(key).join("-");
        const elems = content.querySelectorAll("[df-" + completeKey + "]");
        for (let i = 0; i < elems.length; i++) {
          const elem = elems[i] as HTMLElement;
          if (
            elem instanceof HTMLInputElement ||
            elem instanceof HTMLTextAreaElement ||
            elem instanceof HTMLSelectElement
          ) {
            elem.value = value.toString();
          }
          if (elem.isContentEditable) {
            elem.innerText = value.toString();
          }
        }
      }
    }
  }
}

type EventCallback<Data = unknown> = (data: Data) => void;

type RegisterEventFunction<Event extends string = string, Data = unknown> = (
  event: Event,
  callback: EventCallback<Data>
) => boolean;

type DispatchEventFunction<Event extends string = string, Data = unknown> = (
  event: Event,
  details: Data
) => void;

type EventListener = {
  on: RegisterEventFunction;
  dispatch: DispatchEventFunction;
  removeListener: RegisterEventFunction;
};

export type RenderFunction = (options: {
  register: unknown;
  type: string | number;
  content: HTMLElement;
  editor: Drawflow;
  id: string;
  data: DrawflowNode;
  event: EventListener;
}) => void;

function callRender(
  editor: Drawflow,
  render: RenderFunction,
  type: string | number,
  id: string,
  data: DrawflowNode,
  content: HTMLElement
) {
  const events: Record<string, { listeners: EventCallback[] }> = {};

  const event: EventListener = {
    on(event, callback) {
      // Check if the callback is not a function
      if (typeof callback !== "function") {
        console.error(
          `The listener callback must be a function, the given type is ${typeof callback}`
        );
        return false;
      }
      // Check if the event is not a string
      if (typeof event !== "string") {
        console.error(
          `The event name must be a string, the given type is ${typeof event}`
        );
        return false;
      }

      // Check if this event not exists
      if (events[event] === undefined) {
        events[event] = {
          listeners: [],
        };
      }
      events[event].listeners.push(callback);
    },

    removeListener(event, callback) {
      // Check if this event not exists

      if (!events[event]) return false;

      const listeners = events[event].listeners;
      const listenerIndex = listeners.indexOf(callback);
      const hasListener = listenerIndex > -1;
      if (hasListener) listeners.splice(listenerIndex, 1);
    },

    dispatch(event, details?) {
      // Check if this event not exists
      if (events[event] === undefined) {
        // console.error(`This event: ${event} does not exist`);
        return false;
      }
      events[event].listeners.forEach((listener: EventCallback) => {
        listener(details);
      });
    },
  };

  let selected = false;

  const handle = {
    nodeMoved({ id: id1, x, y }: { id: string; x: number; y: number }) {
      if (id1 === id) {
        event.dispatch("moved", { x, y });
      }
    },
    nodeSelected(id1: string) {
      if (id1 === id) {
        event.dispatch("selected", null);
        selected = true;
      }
    },
    nodeUnselected() {
      if (selected) {
        event.dispatch("unselected", null);
      }
    },
    nodeUpdated({ id: id1, data }: { id: string; data: unknown }) {
      if (id1 === id) {
        event.dispatch("updated", data);
      }
    },
    nodeUpdateId({ oldId, newId }: { oldId: string; newId: string }) {
      if (oldId === id) {
        id = newId;
        event.dispatch("updatedId", newId);
      }
    },
    nodeRemoved(id1: string) {
      if (id1 === id) {
        for (const eventName in handle) {
          const callback: EventCallback = (
            handle as Record<string, EventCallback>
          )[eventName];
          editor.removeListener(eventName, callback);
        }

        event.dispatch("removed", null);
      }
    },
    connectionStart(connection: { output_id: string }) {
      if (connection.output_id === id) {
        event.dispatch("connectionStart", connection);
      }
    },
    connectionCreated(connection: { output_id: string; input_id: string }) {
      if (connection.output_id === id || connection.input_id === id) {
        event.dispatch("connectionCreated", connection);
      }
    },
    connectionRemoved(connection: { output_id: string; input_id: string }) {
      if (connection.output_id === id || connection.input_id === id) {
        event.dispatch("connectionRemoved", connection);
      }
    },
  };

  for (const eventName in handle) {
    const callback: EventCallback = (handle as Record<string, EventCallback>)[
      eventName
    ];
    editor.on(eventName, callback);
  }

  render({
    register: editor.noderegister[type],
    id,
    data,
    type,
    content,
    editor,
    event,
  });
}

export type DrawflowData = {
  drawflow: Record<string, { data: Record<string, DrawflowNode> }>;
};

export type DrawflowNodeData = { [key: string]: string | DrawflowNodeData };

export type DrawflowNode = {
  id: string;
  name: string;
  data: DrawflowNodeData;
  class: string;
  html: string;
  typenode: boolean | string | RenderFunction;
  inputs: Record<string, DrawflowNodeInput>;
  outputs: Record<string, DrawflowNodeOutput>;
  pos_x: number;
  pos_y: number;
};

export type DrawflowNodeInput = {
  connections: {
    node: string;
    input: string;
    points?: { pos_x: number; pos_y: number }[];
  }[];
};

export type DrawflowNodeOutput = {
  connections: {
    node: string;
    output: string;
    points?: { pos_x: number; pos_y: number }[];
  }[];
};

export type DrawflowPoint = {
  x: number;
  y: number;
};

export type DrawflowConnectionOut = {
  output_id: string;
  output_class: string;
};
export type DrawflowConnectionIn = {
  input_id: string;
  input_class: string;
};
export type DrawflowConnection = DrawflowConnectionIn & DrawflowConnectionOut;

type DrawflowOptions = {
  module?: string;
  editor_mode?: "edit" | "view" | "fixed";
  zoom?: number;
  zoom_max?: number;
  zoom_min?: number;
  zoom_value?: number;
  zoom_last_value?: number;
  curvature?: number;
  reroute?: boolean;
  reroute_fix_curvature?: boolean;
  reroute_curvature_start_end?: number;
  reroute_curvature?: number;
  reroute_width?: number;
  force_first_input?: boolean;
  draggable_inputs?: boolean;
  useuuid?: boolean;
  render?: RenderFunction;
};

export default class Drawflow {
  private events: Record<string, { listeners: EventCallback[] }> = {};
  public precanvas: HTMLElement = null;
  public nodeId = 1;
  private ele_selected: HTMLElement | SVGElement = null;
  private node_selected: HTMLElement = null;
  private drag = false;
  private drag_point = false;
  private editor_selected = false;
  private connection = false;
  private connection_ele: SVGElement = null;
  private connection_selected: SVGElement = null;
  public canvas_x = 0;
  public canvas_y = 0;
  private pos_x = 0;
  private pos_x_start = 0;
  private pos_y = 0;
  private pos_y_start = 0;
  private mouse_x = 0;
  private mouse_y = 0;
  private first_click: Element = null;

  public noderegister: Record<string, unknown> = {};
  public drawflow: DrawflowData = { drawflow: { Home: { data: {} } } };

  // Configurable options
  public module = "Home";
  public editor_mode: "edit" | "view" | "fixed" = "edit";
  public zoom = 1;
  public zoom_max = 2;
  public zoom_min = 1 / 10;
  public zoom_value = 0.2;
  public zoom_last_value = 1;
  public curvature = 0.5;
  public reroute = false;
  public reroute_fix_curvature = false;
  public reroute_curvature_start_end = 0.5;
  public reroute_curvature = 0.5;
  public reroute_width = 6;
  public force_first_input = false;
  public draggable_inputs = true;
  public useuuid = false;
  public render: RenderFunction;

  // Mobile
  evCache: PointerEvent[] = [];
  prevDiff = -1;

  constructor(public container: HTMLElement, options: DrawflowOptions = {}) {
    this.module = options.module ?? this.module;
    this.editor_mode = options.editor_mode ?? this.editor_mode;
    this.zoom = options.zoom ?? this.zoom;
    this.zoom_max = options.zoom_max ?? this.zoom_max;
    this.zoom_min = options.zoom_min ?? this.zoom_min;
    this.zoom_value = options.zoom_value ?? this.zoom_value;
    this.zoom_last_value = options.zoom_last_value ?? this.zoom_last_value;
    this.curvature = options.curvature ?? this.curvature;
    this.reroute = options.reroute ?? this.reroute;
    this.reroute_fix_curvature =
      options.reroute_fix_curvature ?? this.reroute_fix_curvature;
    this.reroute_curvature_start_end =
      options.reroute_curvature_start_end ?? this.reroute_curvature_start_end;
    this.reroute_curvature =
      options.reroute_curvature ?? this.reroute_curvature;
    this.reroute_width = options.reroute_width ?? this.reroute_width;
    this.force_first_input =
      options.force_first_input ?? this.force_first_input;
    this.draggable_inputs = options.draggable_inputs ?? this.draggable_inputs;
    this.useuuid = options.useuuid ?? this.useuuid;
    this.render = options.render ?? this.render;
  }

  get zoomLevel() {
    return Math.log2(this.zoom);
  }

  set zoomLevel(value) {
    this.zoom = Math.pow(2, value);
    this.refreshZoom();
  }

  public start() {
    // console.info("Start Drawflow!!");
    this.container.classList.add("parent-drawflow");
    this.container.tabIndex = 0;
    this.precanvas = document.createElement("div");
    this.precanvas.classList.add("drawflow");
    this.container.appendChild(this.precanvas);

    /* Mouse and Touch Actions */
    this.container.addEventListener("mouseup", this._handleInputEnd.bind(this));
    this.container.addEventListener(
      "mousemove",
      this._handleInputMove.bind(this)
    );
    this.container.addEventListener(
      "mousedown",
      this._handleInputStart.bind(this)
    );

    this.container.addEventListener(
      "touchend",
      this._handleInputEnd.bind(this)
    );
    this.container.addEventListener(
      "touchmove",
      this._handleInputMove.bind(this)
    );
    this.container.addEventListener(
      "touchstart",
      this._handleInputStart.bind(this)
    );

    /* Context Menu */
    this.container.addEventListener(
      "contextmenu",
      this._handleContextmenu.bind(this)
    );
    /* Delete */
    this.container.addEventListener("keydown", this._handleKey.bind(this));

    /* Zoom Mouse */
    this.container.addEventListener("wheel", this._handleZoom.bind(this));
    /* Update data Nodes */
    this.container.addEventListener("input", this.updateNodeValue.bind(this));

    this.container.addEventListener("dblclick", this._dblclick.bind(this));
    /* Mobile zoom */
    this.container.onpointerdown = this._handlePointerdown.bind(this);
    this.container.onpointermove = this._handlePointermove.bind(this);
    this.container.onpointerup = this._handlePointerup.bind(this);
    this.container.onpointercancel = this._handlePointerup.bind(this);
    this.container.onpointerout = this._handlePointerup.bind(this);
    this.container.onpointerleave = this._handlePointerup.bind(this);

    this.load();
  }

  /* Mobile zoom */
  private _handlePointerdown(ev: PointerEvent) {
    this.evCache.push(ev);
  }

  private _handlePointermove(ev: PointerEvent) {
    for (let i = 0; i < this.evCache.length; i++) {
      if (ev.pointerId == this.evCache[i].pointerId) {
        this.evCache[i] = ev;
        break;
      }
    }

    if (this.evCache.length == 2) {
      // Calculate the distance between the two pointers
      const curDiff = Math.abs(
        this.evCache[0].clientX - this.evCache[1].clientX
      );

      if (this.prevDiff > 100) {
        if (curDiff > this.prevDiff) {
          // The distance between the two pointers has increased

          this.zoomIn();
        }
        if (curDiff < this.prevDiff) {
          // The distance between the two pointers has decreased
          this.zoomOut();
        }
      }
      this.prevDiff = curDiff;
    }
  }

  private _handlePointerup(ev: PointerEvent) {
    this._removeEvent(ev);
    if (this.evCache.length < 2) {
      this.prevDiff = -1;
    }
  }

  private _removeEvent(ev: PointerEvent) {
    // Remove this event from the target's cache
    for (let i = this.evCache.length - 1; i >= 0; i--) {
      if (this.evCache[i].pointerId == ev.pointerId) {
        this.evCache.splice(i, 1);
        break;
      }
    }
  }
  /* End Mobile Zoom */

  private _handleInputStart(e: MouseEvent | TouchEvent) {
    const clearSelection = () => {
      if (this.node_selected != null) {
        this.node_selected.classList.remove("selected");
        if (this.node_selected != this.ele_selected) {
          this.node_selected = null;
          this.dispatch("nodeDeselected", true);
        }
      }
      if (this.connection_selected != null) {
        this.connection_selected.classList.remove("selected");
        this.deselectConnection();
        this.connection_selected = null;
      }
    };

    this.dispatch("click", e);

    const target = e.target as HTMLElement | SVGElement;

    if (e instanceof MouseEvent && e.button === 1) {
      this.editor_selected = true;
    } else if (e instanceof MouseEvent && e.button === 0) {
      // get selected element
      if (this.editor_mode === "fixed") {
        if (
          target.classList[0] === "parent-drawflow" ||
          target.classList[0] === "drawflow"
        ) {
          this.ele_selected = target.closest(".parent-drawflow");
        } else {
          return false;
        }
      } else if (this.editor_mode === "view") {
        if (
          target.closest(".drawflow") != null ||
          target.matches(".parent-drawflow")
        ) {
          this.ele_selected = target.closest(".parent-drawflow");
          e.preventDefault();
        }
      } else {
        this.first_click = target;
        this.ele_selected = target;
        if (e.button === 0) {
          if (this.precanvas.getElementsByClassName("drawflow-delete").length) {
            this.precanvas
              .getElementsByClassName("drawflow-delete")[0]
              .remove();
          }
        }

        if (target.closest(".drawflow_content_node") != null) {
          this.ele_selected = target.closest(
            ".drawflow_content_node"
          ).parentElement;
        }
      }

      switch (this.ele_selected.classList[0]) {
        case "drawflow-node":
          clearSelection();

          if (this.node_selected != this.ele_selected) {
            this.dispatch("nodeSelected", getNodeID(this.ele_selected.id));
          }

          this.node_selected = this.ele_selected as HTMLElement;
          this.node_selected.classList.add("selected");

          // cancel drag if an input element was clicked on
          if (!this.draggable_inputs) {
            if (
              target.tagName !== "INPUT" &&
              target.tagName !== "TEXTAREA" &&
              target.tagName !== "SELECT" &&
              target.hasAttribute("contenteditable") !== true
            ) {
              this.drag = true;
            }
          } else {
            if (target.tagName !== "SELECT") {
              this.drag = true;
            }
          }
          break;
        case "output":
          this.connection = true;
          clearSelection();
          this._createConnection(target as HTMLElement);
          break;
        case "drawflow":
          clearSelection();
          this.editor_selected = e.type === "touchstart";
          break;
        case "main-path":
          clearSelection();

          this.connection_selected = this.ele_selected as SVGElement;
          this.connection_selected.classList.add("selected");

          this.dispatch(
            "connectionSelected",
            getConnectionData(
              this.connection_selected.ownerSVGElement.classList
            )
          );

          if (this.reroute_fix_curvature) {
            this.connection_selected.parentElement
              .querySelectorAll(".main-path")
              .forEach(
                (item: { classList: { add: (arg0: string) => void } }) => {
                  item.classList.add("selected");
                }
              );
          }
          break;
        case "point":
          this.drag_point = true;
          this.ele_selected.classList.add("selected");
          break;
        case "drawflow-delete":
          if (this.node_selected) {
            this.removeNodeId(this.node_selected.id);
          }

          if (this.connection_selected) {
            this.removeSelectedConnection();
          }

          clearSelection();
          break;
        default:
          break;
      }

      if (this.ele_selected.classList.contains("parent-drawflow")) {
        clearSelection();
        this.editor_selected = e.type === "touchstart";
      }
    }

    if (e instanceof TouchEvent) {
      this.pos_x = e.touches[0].clientX;
      this.pos_x_start = e.touches[0].clientX;
      this.pos_y = e.touches[0].clientY;
      this.pos_y_start = e.touches[0].clientY;
    } else {
      this.pos_x = e.clientX;
      this.pos_x_start = e.clientX;
      this.pos_y = e.clientY;
      this.pos_y_start = e.clientY;
    }

    this.dispatch("clickEnd", e);
  }

  private _handleInputMove(e: MouseEvent | TouchEvent) {
    let e_pos_x: number, e_pos_y: number;
    if (e instanceof TouchEvent) {
      e_pos_x = e.touches[0].clientX;
      e_pos_y = e.touches[0].clientY;
    } else {
      e_pos_x = e.clientX;
      e_pos_y = e.clientY;
    }

    if (this.connection) {
      this._drawConnectionTo(e_pos_x, e_pos_y);
    }

    if (this.editor_selected) {
      const x = this.canvas_x - this.pos_x + e_pos_x;
      const y = this.canvas_y - this.pos_y + e_pos_y;
      this.dispatch("translate", { x: x, y: y });
      this.precanvas.style.transform =
        "translate(" + x + "px, " + y + "px) scale(" + this.zoom + ")";
    }

    if (this.drag) {
      const moduleData = this.drawflow.drawflow[this.module].data;
      const selectedID = getNodeID(this.ele_selected.id);

      const dx = (this.pos_x - e_pos_x) / this.zoom;
      const dy = (this.pos_y - e_pos_y) / this.zoom;
      this.pos_x = e_pos_x;
      this.pos_y = e_pos_y;

      moduleData[selectedID].pos_x -= dx;
      moduleData[selectedID].pos_y -= dy;

      this.ele_selected.style.left = moduleData[selectedID].pos_x + "px";
      this.ele_selected.style.top = moduleData[selectedID].pos_y + "px";

      this.updateNodeConnections(this.ele_selected.id);
    }

    if (this.drag_point) {
      const moduleData = this.drawflow.drawflow[this.module].data;

      this.pos_x = e_pos_x;
      this.pos_y = e_pos_y;

      const pos_x =
        (this.pos_x - this.precanvas.getBoundingClientRect().x) / this.zoom;
      const pos_y =
        (this.pos_y - this.precanvas.getBoundingClientRect().y) / this.zoom;

      this.ele_selected.setAttributeNS(null, "cx", pos_x.toString());
      this.ele_selected.setAttributeNS(null, "cy", pos_y.toString());

      const { output_id, input_id, output_class, input_class } =
        getConnectionData(this.ele_selected.parentElement.classList);

      let numberPointPosition =
        Array.from(this.ele_selected.parentElement.children).indexOf(
          this.ele_selected
        ) - 1;

      if (this.reroute_fix_curvature) {
        const numberMainPath =
          this.ele_selected.parentElement.querySelectorAll(".main-path")
            .length - 1;
        numberPointPosition -= numberMainPath;
        if (numberPointPosition < 0) {
          numberPointPosition = 0;
        }
      }

      const searchConnection = moduleData[output_id].outputs[
        output_class
      ].connections.findIndex(
        (item) => item.node === input_id && item.output === input_class
      );

      moduleData[output_id].outputs[output_class].connections[
        searchConnection
      ].points[numberPointPosition] = {
        pos_x: pos_x,
        pos_y: pos_y,
      };

      this.updateNodeConnections(`node-${output_id}`);
    }

    if (e.type === "touchmove") {
      this.mouse_x = e_pos_x;
      this.mouse_y = e_pos_y;
    }
    this.dispatch("mouseMove", { x: e_pos_x, y: e_pos_y });
  }

  private _handleInputEnd(e: MouseEvent | TouchEvent) {
    let e_pos_x: number;
    let e_pos_y: number;
    let ele_last: Element;
    if (e instanceof TouchEvent) {
      e_pos_x = this.mouse_x;
      e_pos_y = this.mouse_y;
      ele_last = document.elementFromPoint(e_pos_x, e_pos_y);
    } else {
      e_pos_x = e.clientX;
      e_pos_y = e.clientY;
      ele_last = e.target as Element;
    }

    if (this.drag) {
      if (this.pos_x_start != e_pos_x || this.pos_y_start != e_pos_y) {
        const id = getNodeID(this.ele_selected.id);
        const nodeData = this.getNodeFromId(id);
        this.dispatch("nodeMoved", {
          id: id,
          x: nodeData.pos_x,
          y: nodeData.pos_y,
        });
      }
    }

    if (this.drag_point) {
      this.ele_selected.classList.remove("selected");
      if (this.pos_x_start != e_pos_x || this.pos_y_start != e_pos_y) {
        this.dispatch(
          "rerouteMoved",
          getConnectionData(this.ele_selected.parentElement.classList).output_id
        );
      }
    }

    if (this.editor_selected) {
      this.canvas_x = this.canvas_x + -(this.pos_x - e_pos_x);
      this.canvas_y = this.canvas_y + -(this.pos_y - e_pos_y);
      this.editor_selected = false;
    }
    if (this.connection === true) {
      if (
        ele_last.classList[0] === "input" ||
        (this.force_first_input &&
          (ele_last.closest(".drawflow_content_node") != null ||
            ele_last.classList[0] === "drawflow-node"))
      ) {
        let input_id: string, input_class: string;
        if (
          this.force_first_input &&
          (ele_last.closest(".drawflow_content_node") != null ||
            ele_last.classList[0] === "drawflow-node")
        ) {
          if (ele_last.closest(".drawflow_content_node") != null) {
            input_id = ele_last.closest(".drawflow_content_node").parentElement
              .id;
          } else {
            input_id = ele_last.id;
          }

          if (
            Object.keys(this.getNodeFromId(getNodeID(input_id)).inputs)
              .length === 0
          ) {
            input_class = "";
          } else {
            input_class = "input_1";
          }
        } else {
          // Fix connection;
          input_id = ele_last.parentElement.parentElement.id;
          input_class = ele_last.classList[1];
        }
        const output_id = this.ele_selected.parentElement.parentElement.id;
        const output_class = this.ele_selected.classList[1];

        if (output_id !== input_id && input_class) {
          if (
            this.container.querySelectorAll(
              ".connection.node_in_" +
                input_id +
                ".node_out_" +
                output_id +
                "." +
                output_class +
                "." +
                input_class
            ).length === 0
          ) {
            // Conection no exist save connection

            this.connection_ele.classList.add("node_in_" + input_id);
            this.connection_ele.classList.add("node_out_" + output_id);
            this.connection_ele.classList.add(output_class);
            this.connection_ele.classList.add(input_class);
            const id_input = getNodeID(input_id);
            const id_output = getNodeID(output_id);

            this.drawflow.drawflow[this.module].data[id_output].outputs[
              output_class
            ].connections.push({ node: id_input, output: input_class });
            this.drawflow.drawflow[this.module].data[id_input].inputs[
              input_class
            ].connections.push({ node: id_output, input: output_class });
            this.updateNodeConnections("node-" + id_output);
            this.updateNodeConnections("node-" + id_input);
            this.dispatch("connectionCreated", {
              output_id: id_output,
              input_id: id_input,
              output_class: output_class,
              input_class: input_class,
            });
          } else {
            this.dispatch("connectionCancel", true);
            this.connection_ele.remove();
          }

          this.connection_ele = null;
        } else {
          // Connection exists Remove Connection;
          this.dispatch("connectionCancel", true);
          this.connection_ele.remove();
          this.connection_ele = null;
        }
      } else {
        // Remove Connection;
        this.dispatch("connectionCancel", true);
        this.connection_ele.remove();
        this.connection_ele = null;
      }
    }

    this.drag = false;
    this.drag_point = false;
    this.connection = false;
    this.ele_selected = null;
    this.editor_selected = false;

    this.dispatch("mouseUp", e);
  }

  private _handleContextmenu(e: MouseEvent): boolean {
    this.dispatch("contextmenu", e);
    e.preventDefault();
    if (this.editor_mode === "fixed" || this.editor_mode === "view") {
      return false;
    }
    if (this.precanvas.getElementsByClassName("drawflow-delete").length) {
      this.precanvas.getElementsByClassName("drawflow-delete")[0].remove();
    }
    if (this.node_selected || this.connection_selected) {
      const deletebox = document.createElement("div");
      deletebox.classList.add("drawflow-delete");
      deletebox.innerHTML = "x";
      if (this.node_selected) {
        this.node_selected.appendChild(deletebox);
      }
      if (this.connection_selected) {
        deletebox.style.top =
          e.clientY * this.zoom -
          this.precanvas.getBoundingClientRect().y * this.zoom +
          "px";
        deletebox.style.left =
          e.clientX * this.zoom -
          this.precanvas.getBoundingClientRect().x * this.zoom +
          "px";

        this.precanvas.appendChild(deletebox);
      }
    }
  }

  private _handleKey(e: KeyboardEvent): boolean {
    this.dispatch("keydown", e);
    if (this.editor_mode === "fixed" || this.editor_mode === "view") {
      return false;
    }
    if (e.key === "Delete" || (e.key === "Backspace" && e.metaKey)) {
      if (this.node_selected != null) {
        if (
          this.first_click.tagName !== "INPUT" &&
          this.first_click.tagName !== "TEXTAREA" &&
          this.first_click.hasAttribute("contenteditable") !== true
        ) {
          this.removeNodeId(this.node_selected.id);
        }
      }
      if (this.connection_selected != null) {
        this.removeSelectedConnection();
      }
    }
  }

  private _handleZoom(event: WheelEvent) {
    event.preventDefault();
    if (event.ctrlKey) {
      this.zoomLevel -= event.deltaY / 100;
    } else {
      this.canvas_x -= event.deltaX;
      this.canvas_y -= event.deltaY;
      this.dispatch("translate", { x: this.canvas_x, y: this.canvas_y });
      this.precanvas.style.transform =
        "translate(" +
        this.canvas_x +
        "px, " +
        this.canvas_y +
        "px) scale(" +
        this.zoom +
        ")";
    }
  }

  private _dblclick(e: MouseEvent) {
    if (this.connection_selected != null && this.reroute) {
      this.createReroutePoint(this.connection_selected);
    }

    if ((e.target as HTMLElement).classList[0] === "point") {
      this.removeReroutePoint(e.target as SVGElement);
    }
  }

  public refreshZoom(silent = false) {
    this.zoom = Math.min(Math.max(this.zoom_min, this.zoom), this.zoom_max);

    if (!silent) this.dispatch("zoom", this.zoom);
    this.canvas_x = (this.canvas_x / this.zoom_last_value) * this.zoom;
    this.canvas_y = (this.canvas_y / this.zoom_last_value) * this.zoom;
    this.zoom_last_value = this.zoom;
    this.precanvas.style.transform =
      "translate(" +
      this.canvas_x +
      "px, " +
      this.canvas_y +
      "px) scale(" +
      this.zoom +
      ")";
  }

  public zoomIn(value = this.zoom_value) {
    this.zoomLevel += value;
  }

  public zoomOut(value = this.zoom_value) {
    this.zoomLevel -= value;
  }

  public resetZoom(silent = false) {
    if (this.zoom != 1) {
      this.zoom = 1;
      this.refreshZoom(silent);
    }
  }

  public load() {
    for (const key in this.drawflow.drawflow[this.module].data) {
      this._addNodeImport(
        this.drawflow.drawflow[this.module].data[key],
        this.precanvas
      );
    }

    if (this.reroute) {
      for (const key in this.drawflow.drawflow[this.module].data) {
        this._addRerouteImport(this.drawflow.drawflow[this.module].data[key]);
      }
    }

    for (const key in this.drawflow.drawflow[this.module].data) {
      this.updateNodeConnections("node-" + key);
    }

    const editor = this.drawflow.drawflow;
    let number = 1;

    for (const moduleName in editor) {
      if (Object.hasOwnProperty.call(editor, moduleName)) {
        const moduleData = editor[moduleName].data;
        for (const id in moduleData) {
          if (Object.hasOwnProperty.call(moduleData, id)) {
            number = Math.max(number, parseInt(id) + 1);
          }
        }
      }
    }

    this.nodeId = number;
  }

  public deselectConnection(silent = false) {
    if (!silent) this.dispatch("connectionDeselected", true);
    if (this.reroute_fix_curvature) {
      this.connection_selected.parentElement
        .querySelectorAll(".main-path")
        .forEach((item: { classList: { remove: (arg0: string) => void } }) => {
          item.classList.remove("selected");
        });
    }
  }

  public createCurvature(
    start_pos_x: number,
    start_pos_y: number,
    end_pos_x: number,
    end_pos_y: number,
    curvature: number
  ): string {
    const line_x = start_pos_x;
    const line_y = start_pos_y;
    const x = end_pos_x;
    const y = end_pos_y;

    const handleSize = Math.abs(x - line_x) * curvature;

    return (
      "M" +
      [line_x, line_y].join() +
      "C" +
      [line_x + handleSize, line_y, x - handleSize, y, x, y].join()
    );
  }

  private _createConnection(ele: HTMLElement) {
    const connection = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.connection_ele = connection;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("main-path");
    path.setAttributeNS(null, "d", "");
    // path.innerHTML = 'a';
    connection.classList.add("connection");
    connection.appendChild(path);
    this.precanvas.appendChild(connection);

    const id_output = getNodeID(ele.parentElement.parentElement.id);
    const output_class = ele.classList[1];

    this.dispatch("connectionStart", {
      output_id: id_output,
      output_class: output_class,
    });
  }

  private _drawConnectionTo(eX: number, eY: number) {
    const precanvas = this.precanvas;
    const zoom = this.zoom;

    const precanvasRect = precanvas.getBoundingClientRect();
    const path = this.connection_ele.children[0];

    function getCenter(node: HTMLElement | SVGElement): [number, number] {
      const rect = node.getBoundingClientRect();
      return [
        (rect.x - precanvasRect.x + rect.width / 2) / zoom,
        (rect.y - precanvasRect.y + rect.width / 2) / zoom,
      ];
    }

    const [fromX, fromY] = getCenter(this.ele_selected);

    const toX = (eX - this.precanvas.getBoundingClientRect().x) / zoom;
    const toY = (eY - this.precanvas.getBoundingClientRect().y) / zoom;

    const curvature = this.curvature;
    const lineCurve = this.createCurvature(fromX, fromY, toX, toY, curvature);
    path.setAttributeNS(null, "d", lineCurve);
  }

  public addConnection(
    id_output: string,
    id_input: string,
    output_class: string,
    input_class: string,
    silent = false
  ) {
    const nodeOneModule = this.getModuleFromNodeId(id_output);
    const nodeTwoModule = this.getModuleFromNodeId(id_input);

    if (nodeOneModule !== nodeTwoModule) {
      return;
    }

    // Check connection exist
    const moduleData = this.drawflow.drawflow[nodeOneModule].data;

    if (
      !moduleData ||
      !moduleData[id_output] ||
      !moduleData[id_output].outputs[output_class] ||
      !moduleData[id_input] ||
      !moduleData[id_input].inputs[input_class]
    )
      return;

    for (const output of moduleData[id_output].outputs[output_class]
      .connections) {
      if (output.node == id_input && output.output == input_class) {
        return;
      }
    }

    //Create Connection
    moduleData[id_output].outputs[output_class].connections.push({
      node: id_input.toString(),
      output: input_class,
    });
    moduleData[id_input].inputs[input_class].connections.push({
      node: id_output.toString(),
      input: output_class,
    });

    if (this.module === nodeOneModule) {
      //Draw connection
      const connection = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.classList.add("main-path");
      path.setAttributeNS(null, "d", "");
      // path.innerHTML = 'a';
      connection.classList.add("connection");
      connection.classList.add("node_in_node-" + id_input);
      connection.classList.add("node_out_node-" + id_output);
      connection.classList.add(output_class);
      connection.classList.add(input_class);
      connection.appendChild(path);
      this.precanvas.appendChild(connection);
      this.updateNodeConnections("node-" + id_output);
      this.updateNodeConnections("node-" + id_input);
    }

    if (!silent)
      this.dispatch("connectionCreated", {
        output_id: id_output,
        input_id: id_input,
        output_class: output_class,
        input_class: input_class,
      });
  }

  public updateConnection(
    connection: SVGElement,
    nodeFromElem?: HTMLElement,
    nodeToElem?: HTMLElement
  ) {
    const container = this.container;
    const precanvas = this.precanvas;
    const curvature = this.curvature;
    const createCurvature = this.createCurvature;
    const reroute_curvature = this.reroute_curvature;
    const reroute_curvature_start_end = this.reroute_curvature_start_end;
    const reroute_fix_curvature = this.reroute_fix_curvature;
    const rerouteWidth = this.reroute_width;
    const zoom = this.zoom;

    if (!nodeFromElem) {
      const nodeFromID = connection.classList[2].replace("node_out_", "");
      nodeFromElem = container.querySelector(`#${nodeFromID}`);
    }

    if (!nodeToElem) {
      const nodeToID = connection.classList[1].replace("node_in_", "");
      nodeToElem = container.querySelector(`#${nodeToID}`);
    }

    if (!nodeFromElem || !nodeToElem) {
      return;
    }

    const precanvasRect = precanvas.getBoundingClientRect();

    function getCenter(node: HTMLElement): [number, number] {
      const rect = node.getBoundingClientRect();
      return [
        (rect.x - precanvasRect.x + rect.width / 2) / zoom,
        (rect.y - precanvasRect.y + rect.width / 2) / zoom,
      ];
    }

    function getRerouteCenter(node: HTMLElement): [number, number] {
      const rect = node.getBoundingClientRect();
      return [
        (rect.x - precanvasRect.x) / zoom + rerouteWidth,
        (rect.y - precanvasRect.y) / zoom + rerouteWidth,
      ];
    }

    const outputElem = nodeFromElem.querySelector(
      "." + connection.classList[3]
    ) as HTMLElement;

    const [fromX, fromY] = getCenter(outputElem);

    const inputElem = nodeToElem.querySelector(
      "." + connection.classList[4]
    ) as HTMLElement;

    const [toX, toY] = getCenter(inputElem);

    const points = connection.querySelectorAll(
      ".point"
    ) as NodeListOf<HTMLElement>;

    if (points.length === 0) {
      const lineCurve = createCurvature(fromX, fromY, toX, toY, curvature);
      connection.children[0].setAttributeNS(null, "d", lineCurve);
    } else {
      let linecurve = "";
      const reroute_fix = [];

      let lastX = fromX;
      let lastY = fromY;
      let curvature = reroute_curvature_start_end;

      for (let i = 0; i < points.length; i++) {
        const pointElem = points[i];

        const [pointX, pointY] = getRerouteCenter(pointElem);

        const leftCurveSegment = createCurvature(
          lastX,
          lastY,
          pointX,
          pointY,
          curvature
        );
        linecurve += leftCurveSegment;
        reroute_fix.push(leftCurveSegment);

        lastX = pointX;
        lastY = pointY;
        curvature = reroute_curvature;
      }

      curvature = reroute_curvature_start_end;

      const leftCurveSegment = createCurvature(
        lastX,
        lastY,
        toX,
        toY,
        curvature
      );
      linecurve += leftCurveSegment;
      reroute_fix.push(leftCurveSegment);

      if (reroute_fix_curvature) {
        reroute_fix.forEach((itempath, i) => {
          connection.children[i].setAttributeNS(null, "d", itempath);
        });
      } else {
        connection.children[0].setAttributeNS(null, "d", linecurve);
      }
    }
  }

  public updateNodeConnections(id: string) {
    const connectionInTag = "node_in_" + id;
    const connectionOutTag = "node_out_" + id;
    const container = this.container;

    const nodeElem = container.querySelector(`#node-${id}`) as HTMLElement;

    const connectionsOut = container.querySelectorAll(`.${connectionOutTag}`);

    for (let i = 0; i < connectionsOut.length; i++) {
      const connection = connectionsOut[i] as SVGElement;
      this.updateConnection(connection, nodeElem, null);
    }

    const connectionsIn = container.querySelectorAll(`.${connectionInTag}`);

    for (let i = 0; i < connectionsIn.length; i++) {
      const connection = connectionsIn[i] as SVGElement;
      this.updateConnection(connection, null, nodeElem);
    }
  }

  public createReroutePoint(ele: SVGElement, silent = false) {
    this.connection_selected.classList.remove("selected");
    const { output_id, input_id, output_class, input_class } =
      getConnectionData(this.connection_selected.parentElement.classList);
    this.connection_selected = null;

    const point = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    point.classList.add("point");
    const pos_x =
      (this.pos_x - this.precanvas.getBoundingClientRect().x) * this.zoom;
    const pos_y =
      (this.pos_y - this.precanvas.getBoundingClientRect().y) * this.zoom;

    point.setAttributeNS(null, "cx", pos_x.toString());
    point.setAttributeNS(null, "cy", pos_y.toString());
    point.setAttributeNS(null, "r", this.reroute_width.toString());

    let position_add_array_point = 0;
    if (this.reroute_fix_curvature) {
      const numberPoints =
        ele.parentElement.querySelectorAll(".main-path").length;
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.classList.add("main-path");
      path.setAttributeNS(null, "d", "");

      ele.parentElement.insertBefore(
        path,
        ele.parentElement.children[numberPoints]
      );
      if (numberPoints === 1) {
        ele.parentElement.appendChild(point);
      } else {
        const search_point = Array.from(ele.parentElement.children).indexOf(
          ele
        );
        position_add_array_point = search_point;
        ele.parentElement.insertBefore(
          point,
          ele.parentElement.children[search_point + numberPoints + 1]
        );
      }
    } else {
      ele.parentElement.appendChild(point);
    }

    const moduleData = this.drawflow.drawflow[this.module].data;

    const connection = moduleData[output_id].outputs[
      output_class
    ].connections.find(
      (item: { node: string; output: string }) =>
        item.node === input_id && item.output === input_class
    );

    if (connection.points === undefined) {
      connection.points = [];
    }

    if (this.reroute_fix_curvature) {
      if (position_add_array_point > 0) {
        connection.points.splice(position_add_array_point, 0, {
          pos_x: pos_x,
          pos_y: pos_y,
        });
      } else {
        connection.points.push({
          pos_x: pos_x,
          pos_y: pos_y,
        });
      }

      ele.parentElement
        .querySelectorAll(".main-path.selected")
        .forEach((item) => item.classList.remove("selected"));
    } else {
      connection.points.push({
        pos_x: pos_x,
        pos_y: pos_y,
      });
    }

    if (!silent) this.dispatch("rerouteCreated", output_id);
    this.updateConnection(ele.ownerSVGElement);
  }

  public removeReroutePoint(ele: SVGElement, silent = false) {
    const { output_id, input_id, output_class, input_class } =
      getConnectionData(ele.ownerSVGElement.classList);

    let numberPointPosition =
      Array.from(ele.parentElement.children).indexOf(ele) - 1;

    const searchConnection = this.drawflow.drawflow[this.module].data[
      output_id
    ].outputs[output_class].connections.findIndex(
      (item) => item.node === input_id && item.output === input_class
    );

    if (this.reroute_fix_curvature) {
      const numberMainPath =
        ele.parentElement.querySelectorAll(".main-path").length;
      ele.parentElement.children[numberMainPath - 1].remove();
      numberPointPosition -= numberMainPath;
      if (numberPointPosition < 0) {
        numberPointPosition = 0;
      }
    }
    this.drawflow.drawflow[this.module].data[output_id].outputs[
      output_class
    ].connections[searchConnection].points.splice(numberPointPosition, 1);

    ele.remove();
    if (!silent) this.dispatch("rerouteRemoved", output_id);
    this.updateNodeConnections(`node-${output_id}`);
  }

  public registerNode(name: string | number, html: unknown) {
    this.noderegister[name] = html;
  }

  public getNodeFromId(id: string): DrawflowNode {
    const moduleName = this.getModuleFromNodeId(id);
    if (!moduleName) return;
    return JSON.parse(
      JSON.stringify(this.drawflow.drawflow[moduleName].data[id])
    );
  }

  public getNodesFromName(name: string): string[] {
    const nodes: string[] = [];
    const editor = this.drawflow.drawflow;
    Object.keys(editor).map((moduleName) => {
      for (const node in editor[moduleName].data) {
        if (editor[moduleName].data[node].name == name) {
          nodes.push(editor[moduleName].data[node].id);
        }
      }
    });
    return nodes;
  }

  public addNode(
    name: string,
    num_in: number,
    num_out: number,
    ele_pos_x: number,
    ele_pos_y: number,
    classoverride: string,
    data: unknown,
    html: string,
    typenode: boolean | "render" | RenderFunction = false,
    silent = false
  ): string {
    let newNodeId;

    if (this.useuuid) {
      newNodeId = this.getUuid();
    } else {
      newNodeId = this.nodeId.toString();
    }

    const parent = document.createElement("div");
    parent.classList.add("parent-node");

    const node = document.createElement("div");
    node.setAttribute("id", "node-" + newNodeId);
    node.classList.add("drawflow-node");
    if (classoverride) {
      node.classList.add(...classoverride.split(" "));
    }

    const inputs = document.createElement("div");
    inputs.classList.add("inputs");

    const outputs = document.createElement("div");
    outputs.classList.add("outputs");

    const json_inputs: Record<string, DrawflowNodeInput> = {};
    for (let x = 0; x < num_in; x++) {
      const input = document.createElement("div");
      input.classList.add("input");
      input.classList.add("input_" + (x + 1));
      json_inputs["input_" + (x + 1)] = { connections: [] };
      inputs.appendChild(input);
    }

    const json_outputs: Record<string, DrawflowNodeOutput> = {};
    for (let x = 0; x < num_out; x++) {
      const output = document.createElement("div");
      output.classList.add("output");
      output.classList.add("output_" + (x + 1));
      json_outputs["output_" + (x + 1)] = { connections: [] };
      outputs.appendChild(output);
    }

    const content = document.createElement("div");
    content.classList.add("drawflow_content_node");

    insertObjectkeys(content, data);

    node.style.top = ele_pos_y + "px";
    node.style.left = ele_pos_x + "px";

    node.appendChild(inputs);
    node.appendChild(content);
    node.appendChild(outputs);

    parent.appendChild(node);

    this.precanvas.appendChild(parent);

    const json: DrawflowNode = {
      id: newNodeId,
      name: name,
      data: (function convert(
        data: unknown,
        first = true
      ): DrawflowNodeData | string {
        if (
          data === null ||
          data === undefined ||
          (typeof data !== "object" && first)
        ) {
          return {};
        }
        if (typeof data === "object" && !Array.isArray(data)) {
          const obj: DrawflowNodeData = {};

          for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
              const value = (data as Record<string, unknown>)[key];
              obj[key] = convert(value, false);
            }
          }

          return obj;
        }
        return data.toString();
      })(data) as DrawflowNodeData,
      class: classoverride,
      html: html,
      typenode: typenode,
      inputs: json_inputs,
      outputs: json_outputs,
      pos_x: ele_pos_x,
      pos_y: ele_pos_y,
    };

    if (typenode === false) {
      content.innerHTML = html;
    } else if (typenode === true) {
      content.appendChild(
        (this.noderegister[html] as Element)?.cloneNode(true)
      );
    } else if (typeof typenode === "function") {
      callRender(this, typenode, html, newNodeId, json, content);
    } else {
      callRender(this, this.render, html, newNodeId, json, content);
    }

    this.drawflow.drawflow[this.module].data[newNodeId] = json;
    if (!silent) this.dispatch("nodeCreated", newNodeId);

    if (!this.useuuid) {
      this.nodeId++;
    }

    return newNodeId;
  }

  private _addNodeImport(dataNode: DrawflowNode, precanvas: HTMLElement) {
    dataNode.id = dataNode.id.toString();

    const parent = document.createElement("div");
    parent.classList.add("parent-node");

    const node = document.createElement("div");
    node.setAttribute("id", "node-" + dataNode.id);
    node.classList.add("drawflow-node");
    if (dataNode.class) {
      node.classList.add(...dataNode.class.split(" "));
    }

    const inputs = document.createElement("div");
    inputs.classList.add("inputs");

    const outputs = document.createElement("div");
    outputs.classList.add("outputs");

    for (const input_item in dataNode.inputs) {
      if (Object.hasOwnProperty.call(dataNode.inputs, input_item)) {
        const input_connections = dataNode.inputs[input_item].connections;

        const input = document.createElement("div");
        input.classList.add("input");
        input.classList.add(input_item);
        inputs.appendChild(input);

        for (const output_item in input_connections) {
          if (Object.hasOwnProperty.call(input_connections, output_item)) {
            const output_connection = input_connections[output_item];

            output_connection.node = output_connection.node.toString();

            const connection = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "svg"
            );
            const path = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path"
            );
            path.classList.add("main-path");
            path.setAttributeNS(null, "d", "");
            // path.innerHTML = 'a';
            connection.classList.add("connection");
            connection.classList.add("node_in_node-" + dataNode.id);
            connection.classList.add("node_out_node-" + output_connection.node);
            connection.classList.add(output_connection.input);
            connection.classList.add(input_item);

            connection.appendChild(path);
            precanvas.appendChild(connection);
          }
        }
      }
    }

    for (let x = 0; x < Object.keys(dataNode.outputs).length; x++) {
      const output = document.createElement("div");
      output.classList.add("output");
      output.classList.add("output_" + (x + 1));
      outputs.appendChild(output);
    }

    const content = document.createElement("div");
    content.classList.add("drawflow_content_node");

    if (dataNode.typenode === false) {
      content.innerHTML = dataNode.html;
    } else if (dataNode.typenode === true) {
      content.appendChild(
        (this.noderegister[dataNode.html] as HTMLElement).cloneNode(true)
      );
    } else if (typeof dataNode.typenode === "function") {
      callRender(
        this,
        dataNode.typenode,
        dataNode.html,
        dataNode.id,
        dataNode,
        content
      );
    } else {
      callRender(
        this,
        this.render,
        dataNode.html,
        dataNode.id,
        dataNode,
        content
      );
    }

    insertObjectkeys(content, dataNode.data);

    node.style.top = dataNode.pos_y + "px";
    node.style.left = dataNode.pos_x + "px";

    node.appendChild(inputs);
    node.appendChild(content);
    node.appendChild(outputs);

    parent.appendChild(node);

    this.precanvas.appendChild(parent);
  }

  private _addRerouteImport(dataNode: DrawflowNode) {
    const reroute_width = this.reroute_width;
    const reroute_fix_curvature = this.reroute_fix_curvature;
    const container = this.container;

    for (const output_class in dataNode.outputs) {
      if (
        Object.prototype.hasOwnProperty.call(dataNode.outputs, output_class)
      ) {
        const output_item = dataNode.outputs[output_class];

        for (const input_class in output_item.connections) {
          if (
            Object.prototype.hasOwnProperty.call(
              output_item.connections,
              input_class
            )
          ) {
            const input_item = output_item.connections[input_class];

            const points = input_item.points;
            if (Array.isArray(input_item.points)) {
              const input_id = input_item.node;
              const input_class = input_item.output;
              const ele = container.querySelector(
                ".connection.node_in_node-" +
                  input_id +
                  ".node_out_node-" +
                  dataNode.id +
                  "." +
                  output_item +
                  "." +
                  input_class
              );

              if (reroute_fix_curvature) {
                for (let z = 0; z < points.length; z++) {
                  const path = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                  );
                  path.classList.add("main-path");
                  path.setAttributeNS(null, "d", "");
                  ele.appendChild(path);
                }
              }

              for (const item of input_item.points) {
                const point = document.createElementNS(
                  "http://www.w3.org/2000/svg",
                  "circle"
                );
                point.classList.add("point");

                point.setAttributeNS(null, "cx", item.pos_x.toString());
                point.setAttributeNS(null, "cy", item.pos_y.toString());
                point.setAttributeNS(null, "r", reroute_width.toString());

                ele.appendChild(point);
              }
            }
          }
        }
      }
    }
  }

  public changeNodeID(oldId: string, newId: string, silent = false): boolean {
    const moduleName = this.getModuleFromNodeId(oldId);

    if (!moduleName) return false;

    const moduleData = this.drawflow.drawflow[moduleName].data;
    const node = moduleData[oldId];

    if (this.getNodeFromId(newId) || oldId === newId) return false;

    delete moduleData[oldId];
    moduleData[newId] = node;

    node.id = newId;
    const nodeEl = this.precanvas.querySelector(`#node-${oldId}`);
    nodeEl.id = `node-${newId}`;

    for (const input_class in node.inputs) {
      const input = node.inputs[input_class];
      for (const connectionIn of input.connections) {
        const input_node = this.getNodeFromId(connectionIn.node);
        for (const output_class in input_node.outputs) {
          const output = input_node.outputs[output_class];
          for (const connection of output.connections) {
            if (
              connection.node === oldId &&
              connection.output === input_class
            ) {
              connection.node = newId;
            }
          }
        }
      }
    }

    for (const output_class in node.outputs) {
      const output = node.outputs[output_class];
      for (const connectionOut of output.connections) {
        const output_node = this.getNodeFromId(connectionOut.node);
        for (const input_class in output_node.inputs) {
          const input = output_node.inputs[input_class];
          for (const connection of input.connections) {
            if (
              connection.node === oldId &&
              connection.input === output_class
            ) {
              connection.node = newId;
            }
          }
        }
      }
    }

    const connectionEls = this.precanvas.querySelectorAll(
      `.node_in_node-${oldId},.node_out_node-${newId}`
    );

    connectionEls.forEach((el) => {
      el.classList.replace(`.node_in_node-${oldId}`, `.node_in_node-${newId}`);
      el.classList.replace(
        `.node_out_node-${oldId}`,
        `.node_out_node-${newId}`
      );
    });

    if (!silent) this.dispatch("updateNodeId", { oldId, newId: node.id });

    return true;
  }

  public updateNodeValue(event: Event, silent = false) {
    const etarget = event.target as HTMLElement;
    const attr = etarget.attributes;

    for (let i = 0; i < attr.length; i++) {
      if (attr[i].nodeName.startsWith("df-")) {
        const keys = attr[i].nodeName.slice(3).split("-");
        let target =
          this.drawflow.drawflow[this.module].data[
            getNodeID(
              etarget.closest(".drawflow_content_node").parentElement.id
            )
          ].data;
        for (let index = 0; index < keys.length - 1; index += 1) {
          if (target[keys[index]] == null) {
            target[keys[index]] = {};
          }
          target = target[keys[index]] as DrawflowNodeData;
        }
        target[keys[keys.length - 1]] = (etarget as HTMLInputElement).value;
        if (etarget.isContentEditable) {
          target[keys[keys.length - 1]] = etarget.innerText;
        }
        if (!silent)
          this.dispatch(
            "nodeDataChanged",
            getNodeID(
              etarget.closest(".drawflow_content_node").parentElement.id
            )
          );
      }
    }
  }

  public updateNodeDataFromId(id: string, data: DrawflowNodeData) {
    const moduleName = this.getModuleFromNodeId(id);
    this.drawflow.drawflow[moduleName].data[id].data = data;
    if (this.module === moduleName) {
      const content = this.container.querySelector(
        "#node-" + id
      ) as HTMLElement;

      insertObjectkeys(content, data);
    }
  }

  public addNodeInput(id: string) {
    const moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    const numInputs = Object.keys(infoNode.inputs).length;
    if (this.module === moduleName) {
      //Draw input
      const input = document.createElement("div");
      input.classList.add("input");
      input.classList.add("input_" + (numInputs + 1));
      const parent = this.container.querySelector("#node-" + id + " .inputs");
      parent.appendChild(input);
      this.updateNodeConnections("node-" + id);
    }
    this.drawflow.drawflow[moduleName].data[id].inputs[
      "input_" + (numInputs + 1)
    ] = { connections: [] };
  }

  public addNodeOutput(id: string) {
    const moduleName = this.getModuleFromNodeId(id);
    const infoNode = this.getNodeFromId(id);
    const numOutputs = Object.keys(infoNode.outputs).length;
    if (this.module === moduleName) {
      //Draw output
      const output = document.createElement("div");
      output.classList.add("output");
      output.classList.add("output_" + (numOutputs + 1));
      const parent = this.container.querySelector("#node-" + id + " .outputs");
      parent.appendChild(output);
      this.updateNodeConnections("node-" + id);
    }
    this.drawflow.drawflow[moduleName].data[id].outputs[
      "output_" + (numOutputs + 1)
    ] = { connections: [] };
  }

  public removeNodeInput(id: string, input_class: string, silent = false) {
    const moduleName = this.getModuleFromNodeId(id);
    const nodeDataRef = this.drawflow.drawflow[moduleName].data[id];

    if (this.module === moduleName) {
      this.container
        .querySelector("#node-" + id + " .inputs .input." + input_class)
        .remove();
    }

    for (const connection of nodeDataRef.inputs[input_class].connections) {
      this.removeConnection(
        connection.node,
        id,
        connection.input,
        input_class,
        silent
      );
    }

    // update inputs
    const input_index = parseInt(input_class.slice("input_".length)) - 1;
    const num_in = Object.keys(nodeDataRef.inputs).length;

    for (let i = input_index; i <= num_in; i++) {
      const class_this = "input_" + (i + 1);
      const class_next = "input_" + (i + 2);

      nodeDataRef.inputs[class_this] = nodeDataRef.inputs[class_next];

      for (const connectionFrom of nodeDataRef.inputs[class_this].connections) {
        const sourceNodeDataRef =
          this.drawflow.drawflow[moduleName].data[connectionFrom.node];

        for (const output_class in sourceNodeDataRef.outputs) {
          if (
            Object.prototype.hasOwnProperty.call(
              sourceNodeDataRef.outputs,
              output_class
            )
          ) {
            for (const connectionTo of sourceNodeDataRef.outputs[output_class]
              .connections) {
              if (
                connectionTo.node === id &&
                connectionTo.output === class_next
              ) {
                connectionTo.output = class_this;

                if (this.module === moduleName) {
                  const connectionEl = this.container.querySelector(
                    ".connection.node_in_node-" +
                      connectionTo.node +
                      ".node_out_node-" +
                      connectionFrom.node +
                      "." +
                      connectionTo.output +
                      "." +
                      connectionFrom.input
                  );

                  connectionEl.classList.replace(class_next, class_this);
                }
              }
            }
          }
        }
      }

      if (this.module === moduleName) {
        const input_el = this.container.querySelector(
          "#node-" + id + " .inputs .input" + class_next
        );

        input_el.classList.replace(class_next, class_this);
      }
    }

    delete nodeDataRef.inputs["input_" + num_in];

    this.updateNodeConnections("node-" + id);
  }

  public removeNodeOutput(id: string, output_class: string, silent = false) {
    const moduleName = this.getModuleFromNodeId(id);
    const nodeDataRef = this.drawflow.drawflow[moduleName].data[id];

    if (this.module === moduleName) {
      this.container
        .querySelector("#node-" + id + " .outputs .output." + output_class)
        .remove();
    }

    for (const connection of nodeDataRef.outputs[output_class].connections) {
      this.removeConnection(
        connection.node,
        id,
        connection.output,
        output_class,
        silent
      );
    }

    // update outputs
    const output_index = parseInt(output_class.slice("output_".length)) - 1;
    const num_in = Object.keys(nodeDataRef.outputs).length;

    for (let i = output_index; i <= num_in; i++) {
      const class_this = "output_" + (i + 1);
      const class_next = "output_" + (i + 2);

      nodeDataRef.outputs[class_this] = nodeDataRef.outputs[class_next];

      for (const connectionFrom of nodeDataRef.outputs[class_this]
        .connections) {
        const sourceNodeDataRef =
          this.drawflow.drawflow[moduleName].data[connectionFrom.node];

        for (const input_class in sourceNodeDataRef.inputs) {
          if (
            Object.prototype.hasOwnProperty.call(
              sourceNodeDataRef.inputs,
              input_class
            )
          ) {
            for (const connectionTo of sourceNodeDataRef.inputs[input_class]
              .connections) {
              if (
                connectionTo.node === id &&
                connectionTo.input === class_next
              ) {
                connectionTo.input = class_this;

                if (this.module === moduleName) {
                  const connectionEl = this.container.querySelector(
                    ".connection.node_in_node-" +
                      connectionTo.node +
                      ".node_out_node-" +
                      connectionFrom.node +
                      "." +
                      connectionTo.input +
                      "." +
                      connectionFrom.output
                  );

                  connectionEl.classList.replace(class_next, class_this);
                }
              }
            }
          }
        }
      }

      if (this.module === moduleName) {
        const output_el = this.container.querySelector(
          "#node-" + id + " .outputs .output" + class_next
        );

        output_el.classList.replace(class_next, class_this);
      }
    }

    delete nodeDataRef.outputs["output_" + num_in];

    this.updateNodeConnections("node-" + id);
  }

  public removeNodeId(id: string, silent = true) {
    this.removeNodeConnectionsByNodeId(id, silent);
    const moduleName = this.getModuleFromNodeId(getNodeID(id));
    if (this.module === moduleName) {
      this.container.querySelector(`#${id}`).remove();
    }
    delete this.drawflow.drawflow[moduleName].data[getNodeID(id)];
    if (!silent) this.dispatch("nodeRemoved", getNodeID(id));
  }

  public removeSelectedConnection(silent = false) {
    if (this.connection_selected != null) {
      const elem = this.connection_selected.parentElement;

      const { output_id, input_id, output_class, input_class } =
        getConnectionData(elem.classList);

      elem.remove();

      const moduleData = this.drawflow.drawflow[this.module].data;

      const index_out = moduleData[output_id].outputs[
        output_class
      ].connections.findIndex(
        (item) => item.node === input_id && item.output === input_class
      );
      moduleData[output_id].outputs[output_class].connections.splice(
        index_out,
        1
      );

      const index_in = moduleData[input_id].inputs[
        input_class
      ].connections.findIndex(
        (item) => item.node === output_id && item.input === output_class
      );
      moduleData[input_id].inputs[input_class].connections.splice(index_in, 1);

      if (!silent)
        this.dispatch("connectionRemoved", {
          output_id: output_id,
          input_id: input_id,
          output_class: output_class,
          input_class: input_class,
        });
      this.connection_selected = null;
    }
  }

  public removeConnection(
    id_output: string,
    id_input: string,
    output_class: string,
    input_class: string,
    silent = false
  ): boolean {
    const nodeOneModule = this.getModuleFromNodeId(id_output);
    const nodeTwoModule = this.getModuleFromNodeId(id_input);
    if (nodeOneModule === nodeTwoModule) {
      // Check nodes in same module.

      // Check connection exist
      const exists = this.drawflow.drawflow[nodeOneModule].data[
        id_output
      ].outputs[output_class].connections.findIndex(
        (item: { node: string; output: string }) =>
          item.node == id_input && item.output === input_class
      );
      if (exists > -1) {
        if (this.module === nodeOneModule) {
          // In same module with view.
          this.container
            .querySelector(
              ".connection.node_in_node-" +
                id_input +
                ".node_out_node-" +
                id_output +
                "." +
                output_class +
                "." +
                input_class
            )
            .remove();
        }

        const index_out = this.drawflow.drawflow[nodeOneModule].data[
          id_output
        ].outputs[output_class].connections.findIndex(
          (item: { node: string; output: string }) =>
            item.node == id_input && item.output === input_class
        );
        this.drawflow.drawflow[nodeOneModule].data[id_output].outputs[
          output_class
        ].connections.splice(index_out, 1);

        const index_in = this.drawflow.drawflow[nodeOneModule].data[
          id_input
        ].inputs[input_class].connections.findIndex(
          (item: { node: string; input: string }) =>
            item.node == id_output && item.input === output_class
        );
        this.drawflow.drawflow[nodeOneModule].data[id_input].inputs[
          input_class
        ].connections.splice(index_in, 1);

        if (!silent)
          this.dispatch("connectionRemoved", {
            output_id: id_output,
            input_id: id_input,
            output_class: output_class,
            input_class: input_class,
          });
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  public removeNodeConnectionsByNodeId(id: string, silent = false) {
    const connectionInTag = "node_in_" + id;
    const connectionOutTag = "node_out_" + id;

    const moduleData = this.drawflow.drawflow[this.module].data;

    const connectionsOut = this.container.querySelectorAll(
      `.${connectionOutTag}`
    );

    for (let i = connectionsOut.length - 1; i >= 0; i--) {
      const { output_id, input_id, output_class, input_class } =
        getConnectionData(connectionsOut[i].classList);

      const index_in = moduleData[input_id].inputs[
        input_class
      ].connections.findIndex(
        (item) => item.node === output_id && item.input === output_class
      );
      moduleData[input_id].inputs[input_class].connections.splice(index_in, 1);

      const index_out = moduleData[output_id].outputs[
        output_class
      ].connections.findIndex(
        (item) => item.node === input_id && item.output === input_class
      );
      moduleData[output_id].outputs[output_class].connections.splice(
        index_out,
        1
      );

      connectionsOut[i].remove();

      if (!silent)
        this.dispatch("connectionRemoved", {
          output_id,
          input_id,
          output_class,
          input_class,
        });
    }

    const connectionsIn = this.container.querySelectorAll(
      `.${connectionInTag}`
    );

    for (let i = connectionsIn.length - 1; i >= 0; i--) {
      const { output_id, input_id, output_class, input_class } =
        getConnectionData(connectionsIn[i].classList);

      const index_out = moduleData[output_id].outputs[
        output_class
      ].connections.findIndex(
        (item) => item.node === input_id && item.output === input_class
      );
      moduleData[output_id].outputs[output_class].connections.splice(
        index_out,
        1
      );

      const index_in = moduleData[input_id].inputs[
        input_class
      ].connections.findIndex(
        (item) => item.node === output_id && item.input === output_class
      );
      moduleData[input_id].inputs[input_class].connections.splice(index_in, 1);

      connectionsIn[i].remove();

      if (!silent)
        this.dispatch("connectionRemoved", {
          output_id,
          input_id,
          output_class,
          input_class,
        });
    }
  }

  public getModuleFromNodeId(id: number | string): string {
    const editor = this.drawflow.drawflow;

    for (const moduleName in editor) {
      if (Object.hasOwnProperty.call(editor, moduleName)) {
        const moduleData = editor[moduleName].data;
        for (const nodeId in moduleData) {
          if (
            Object.hasOwnProperty.call(moduleData, nodeId) &&
            nodeId === id.toString()
          ) {
            return moduleName;
          }
        }
      }
    }
  }

  public addModule(name: string, silent = false) {
    this.drawflow.drawflow[name] = { data: {} };
    if (!silent) this.dispatch("moduleCreated", name);
  }

  public changeModule(name: string, silent = false) {
    if (!silent) this.dispatch("moduleChanged", name);
    this.module = name;
    this.precanvas.innerHTML = "";
    this.canvas_x = 0;
    this.canvas_y = 0;
    this.pos_x = 0;
    this.pos_y = 0;
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.zoom = 1;
    this.zoom_last_value = 1;
    this.precanvas.style.transform = "";
    this.import(this.drawflow, false);
  }

  public removeModule(name: string, silent = false) {
    if (this.module === name) {
      this.changeModule("Home", silent);
    }
    delete this.drawflow.drawflow[name];
    if (!silent) this.dispatch("moduleRemoved", name);
  }

  public clearSelectedModule() {
    while (this.precanvas.hasChildNodes()) {
      this.precanvas.firstChild.remove();
    }
    this.drawflow.drawflow[this.module] = { data: {} };
  }

  public clear() {
    while (this.precanvas.hasChildNodes()) {
      this.precanvas.firstChild.remove();
    }
    this.drawflow = { drawflow: { Home: { data: {} } } };
  }

  public export(silent = false): DrawflowData {
    const dataExport = JSON.parse(JSON.stringify(this.drawflow));
    if (!silent) this.dispatch("export", dataExport);
    return dataExport;
  }

  public import(data: DrawflowData, silent = false) {
    this.clear();
    this.drawflow = JSON.parse(JSON.stringify(data));
    this.load();
    if (!silent) {
      this.dispatch("import", "import");
    }
  }

  /* Events */
  public on(event: "rerouteCreated", callback: (data: string) => void): boolean;
  public on(
    event: "click",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public on(
    event: "clickEnd",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public on(event: "connectionCancel", callback: (data: true) => void): boolean;
  public on(
    event: "connectionCreated",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public on(
    event: "connectionRemoved",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public on(
    event: "connectionSelected",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public on(
    event: "connectionStart",
    callback: (data: DrawflowConnectionOut) => void
  ): boolean;
  public on(
    event: "connectionDeselected",
    callback: (data: true) => void
  ): boolean;
  public on(
    event: "contextmenu",
    callback: (data: MouseEvent) => void
  ): boolean;
  public on(event: "export", callback: (data: DrawflowData) => void): boolean;
  public on(event: "import", callback: (data: "import") => void): boolean;
  public on(event: "keydown", callback: (data: KeyboardEvent) => void): boolean;
  public on(event: "moduleChanged", callback: (data: string) => void): boolean;
  public on(event: "moduleCreated", callback: (data: string) => void): boolean;
  public on(event: "moduleRemoved", callback: (data: string) => void): boolean;
  public on(
    event: "mouseMove",
    callback: (data: DrawflowPoint) => void
  ): boolean;
  public on(
    event: "mouseUp",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public on(event: "nodeCreated", callback: (data: string) => void): boolean;
  public on(
    event: "nodeDataChanged",
    callback: (data: string) => void
  ): boolean;
  public on(
    event: "nodeMoved",
    callback: (data: { id: string } & DrawflowPoint) => void
  ): boolean;
  public on(event: "nodeRemoved", callback: (data: string) => void): boolean;
  public on(event: "nodeSelected", callback: (data: string) => void): boolean;
  public on(event: "nodeDeselected", callback: (data: true) => void): boolean;
  public on(event: "rerouteRemoved", callback: (data: string) => void): boolean;
  public on(event: "rerouteMoved", callback: (data: string) => void): boolean;
  public on(
    event: "translate",
    callback: (data: DrawflowPoint) => void
  ): boolean;
  public on(
    event: "updateNodes",
    callback: (data: { id: string; data: unknown }) => void
  ): boolean;
  public on(
    event: "updateNodeId",
    callback: (data: { newId: string; oldId: string }) => void
  ): boolean;
  public on(event: "zoom", callback: (data: number) => void): boolean;
  public on(event: string, callback: (data: unknown) => void): boolean;
  public on(event: string, callback: unknown): boolean {
    // Check if the callback is not a function
    if (typeof callback !== "function") {
      console.error(
        `The listener callback must be a function, the given type is ${typeof callback}`
      );
      return false;
    }
    // Check if the event is not a string
    if (typeof event !== "string") {
      console.error(
        `The event name must be a string, the given type is ${typeof event}`
      );
      return false;
    }
    // Check if this event not exists
    if (this.events[event] === undefined) {
      this.events[event] = {
        listeners: [],
      };
    }
    this.events[event].listeners.push(callback as EventCallback);
    return true;
  }

  public removeListener(
    event: "rerouteCreated",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "click",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public removeListener(
    event: "clickEnd",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public removeListener(
    event: "connectionCancel",
    callback: (data: true) => void
  ): boolean;
  public removeListener(
    event: "connectionCreated",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public removeListener(
    event: "connectionRemoved",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public removeListener(
    event: "connectionSelected",
    callback: (data: DrawflowConnection) => void
  ): boolean;
  public removeListener(
    event: "connectionStart",
    callback: (data: DrawflowConnectionOut) => void
  ): boolean;
  public removeListener(
    event: "connectionDeselected",
    callback: (data: true) => void
  ): boolean;
  public removeListener(
    event: "contextmenu",
    callback: (data: MouseEvent) => void
  ): boolean;
  public removeListener(
    event: "export",
    callback: (data: DrawflowData) => void
  ): boolean;
  public removeListener(
    event: "import",
    callback: (data: "import") => void
  ): boolean;
  public removeListener(
    event: "keydown",
    callback: (data: KeyboardEvent) => void
  ): boolean;
  public removeListener(
    event: "moduleChanged",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "moduleCreated",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "moduleRemoved",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "mouseMove",
    callback: (data: DrawflowPoint) => void
  ): boolean;
  public removeListener(
    event: "mouseUp",
    callback: (data: MouseEvent | TouchEvent) => void
  ): boolean;
  public removeListener(
    event: "nodeCreated",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "nodeDataChanged",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "nodeMoved",
    callback: (data: { id: string } & DrawflowPoint) => void
  ): boolean;
  public removeListener(
    event: "nodeRemoved",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "nodeSelected",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "nodeDeselected",
    callback: (data: true) => void
  ): boolean;
  public removeListener(
    event: "rerouteRemoved",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "rerouteMoved",
    callback: (data: string) => void
  ): boolean;
  public removeListener(
    event: "translate",
    callback: (data: DrawflowPoint) => void
  ): boolean;
  public removeListener(
    event: "updateNodes",
    callback: (data: { id: string; data: unknown }) => void
  ): boolean;
  public removeListener(
    event: "updateNodeId",
    callback: (data: { newId: string; oldId: string }) => void
  ): boolean;
  public removeListener(
    event: "zoom",
    callback: (data: number) => void
  ): boolean;
  public removeListener(
    event: string,
    callback: (data: unknown) => void
  ): boolean;
  public removeListener(event: string, callback: unknown): boolean {
    // Check if this event not exists

    if (!this.events[event]) return false;

    const listeners = this.events[event].listeners;
    const listenerIndex = listeners.indexOf(
      callback as (data: unknown) => void
    );
    const hasListener = listenerIndex > -1;
    if (hasListener) listeners.splice(listenerIndex, 1);

    return hasListener;
  }

  public dispatch(event: "rerouteCreated", details: string): boolean;
  public dispatch(event: "click", details: MouseEvent | TouchEvent): boolean;
  public dispatch(event: "clickEnd", details: MouseEvent | TouchEvent): boolean;
  public dispatch(event: "connectionCancel", details: true): boolean;
  public dispatch(
    event: "connectionCreated",
    details: DrawflowConnection
  ): boolean;
  public dispatch(
    event: "connectionRemoved",
    details: DrawflowConnection
  ): boolean;
  public dispatch(
    event: "connectionSelected",
    details: DrawflowConnection
  ): boolean;
  public dispatch(
    event: "connectionStart",
    details: DrawflowConnectionOut
  ): boolean;
  public dispatch(event: "connectionDeselected", details: true): boolean;
  public dispatch(event: "contextmenu", details: MouseEvent): boolean;
  public dispatch(event: "export", details: DrawflowData): boolean;
  public dispatch(event: "import", details: "import"): boolean;
  public dispatch(event: "keydown", details: KeyboardEvent): boolean;
  public dispatch(event: "moduleChanged", details: string): boolean;
  public dispatch(event: "moduleCreated", details: string): boolean;
  public dispatch(event: "moduleRemoved", details: string): boolean;
  public dispatch(event: "mouseMove", details: DrawflowPoint): boolean;
  public dispatch(event: "mouseUp", details: MouseEvent | TouchEvent): boolean;
  public dispatch(event: "nodeCreated", details: string): boolean;
  public dispatch(event: "nodeDataChanged", details: string): boolean;
  public dispatch(
    event: "nodeMoved",
    details: { id: string } & DrawflowPoint
  ): boolean;
  public dispatch(event: "nodeRemoved", details: string): boolean;
  public dispatch(event: "nodeSelected", details: string): boolean;
  public dispatch(event: "nodeDeselected", details: true): boolean;
  public dispatch(event: "rerouteRemoved", details: string): boolean;
  public dispatch(event: "rerouteMoved", details: string): boolean;
  public dispatch(event: "translate", details: DrawflowPoint): boolean;
  public dispatch(
    event: "updateNodes",
    details: { id: string; data: unknown }
  ): boolean;
  public dispatch(
    event: "updateNodeId",
    details: { oldId: string; newId: string }
  ): boolean;
  public dispatch(event: "zoom", details: number): boolean;
  public dispatch(event: string, details: unknown): boolean;
  public dispatch(event: string, details: unknown): boolean {
    // Check if this event not exists
    if (this.events[event] === undefined) {
      // console.error(`This event: ${event} does not exist`);
      return false;
    }

    for (const listener of this.events[event].listeners.slice()) {
      listener(details);
    }

    return true;
  }

  private getUuid(): string {
    // http://www.ietf.org/rfc/rfc4122.txt

    const s: string[] = [];
    const hexDigits = "0123456789abcdef";
    for (let i = 0; i < 36; i++) {
      s[i] = hexDigits.charAt(Math.floor(Math.random() * 0x10));
    }
    s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.charAt((parseInt(s[19], 16) & 0x3) | 0x8); // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    return s.join("");
  }
}
