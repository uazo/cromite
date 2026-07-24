# Android protected keyboard geometry

This document describes the architecture of Cromite's **Android Protected
Keyboard Geometry** patch. The patch prevents the on-screen keyboard from
changing page-observable geometry while keeping the editable element that
requested the IME usable.

The protection does not attempt to hide the fact that the user is typing. A
page can still observe focus, keyboard events, and changes produced by its own
application logic. The objective is narrower: do not disclose keyboard size
and geometry through viewport measurements, CSS, or the Virtual Keyboard API.

## Problem

Under the standard Android behavior, the IME can:

- shrink the native view containing Chromium;
- change the layout viewport and visual viewport;
- alter dynamic CSS viewport units and browser-controls dimensions;
- expose `navigator.virtualKeyboard.boundingRect`;
- populate the CSS `keyboard-inset-*` environment variables;
- produce measurable differences between keyboards, configurations, and
  devices.

Using `overlays-content` alone avoids part of the resize, but does not solve
the problem: keyboard geometry remains available to the page and the IME can
cover the focused input.

The patch therefore separates two geometries:

- the **logical viewport**, kept stable and observed by Blink;
- the **physical viewport**, resized by Android and panned natively to keep the
  input visible.

## View hierarchy

When the global kill switch is enabled, `CompositorViewHolder` creates this
hierarchy:

```text
CompositorViewHolder
└── ProtectedViewportScrollView
    └── mScrollContent
        └── mContent
            ├── CompositorView
            └── tab ContentView
```

`ProtectedViewportScrollView` is a specialized `ScrollView`; it is not a
normal page scrolling area. `mContent` retains the neutral height observed
before the IME opens, while the outer `ScrollView` may shrink with the Android
window.

This creates physical pan range around Chromium content that has not been
resized. Moving the `ScrollView` does not directly change `window.scrollY` or
Blink's logical viewport dimensions.

When the global kill switch is disabled, the wrapper is not created and
`CompositorViewHolder` retains Chromium's original hierarchy. Changing the
kill switch therefore requires recreating the UI, normally by restarting the
browser.

## Policy and content setting

The Blink feature `AndroidProtectedKeyboardGeometry` is enabled by default and
acts as the global kill switch. Cromite's
`sAndroidProtectedKeyboardGeometry` Java class reads the same feature without
adding a new entry to `ChromeFeatureList.java`.

The effective decision is also controlled by the
`PROTECTED_KEYBOARD_GEOMETRY` content setting:

- `ALLOW`, the default: protection enabled;
- `BLOCK`: standard Chromium behavior;
- WebUI and extension pages: protection disabled;
- Android only;
- per-site exceptions supported.

Java stores the decision in `TabWebContentsObserver` for the current document.
The cache is invalidated when a new `WebContents` is initialized and after
every committed primary-main-frame navigation. `CompositorViewHolder` then
re-evaluates policy, resets transient state from the previous document, and
realigns the virtual-keyboard mode.

The renderer obtains the same decision through
`Page::IsAndroidProtectedKeyboardGeometryEnabled()`, which checks the feature,
the renderer content setting, and the current scheme. This avoids transporting
a second policy value through `VisualProperties`.

A content-setting change should be followed by a reload. This lets Java and
Blink start the new document with the same decision instead of changing the
geometry model in the middle of an active page.

## Geometry exposed to the page

While protection is enabled:

1. `ViewportData::GetVirtualKeyboardOverlaysContent()` forces
   `overlays-content`, regardless of the page's request.
2. `CompositorViewHolder` uses `VirtualKeyboardMode.OVERLAYS_CONTENT` as its
   default mode.
3. `LocalFrameMojoHandler::NotifyVirtualKeyboardOverlayRect()` sends an empty
   rectangle to Blink observers instead of the real IME geometry.
4. `ProtectedViewportScrollView` keeps `mContent` at the largest neutral height
   observed for the current width.
5. During an IME transition, browser-controls dimensions and insets returned
   to Blink come from a protected snapshot.

Values that should remain invariant between the closed- and open-keyboard
states include at least:

- `window.innerHeight`;
- `document.documentElement.clientHeight`;
- `visualViewport.height`;
- `dvh`, `svh`, and `lvh` units;
- screen geometry;
- `navigator.virtualKeyboard.boundingRect`;
- `env(keyboard-inset-*)`.

The Virtual Keyboard API rectangle should be empty and its CSS insets should
be zero.

## Positioning the editable

Keeping Blink at its neutral dimensions prevents Android's normal resize path
from automatically moving the input above the keyboard. The patch therefore
reconstructs a physical target.

`ImeAdapterImpl` retains:

- the focused editable bounds received from Blink;
- the more precise caret bounds, when available through `CursorAnchorInfo`.

When Android confirms that the keyboard is visible, `ImeAdapterImpl` calls
`requestRectangleOnScreen()`. The caret is preferred and the editable
rectangle is used as a fallback. A collapsed caret is preserved as a
one-pixel-wide rectangle because `Rect.isEmpty()` considers zero-width
geometry empty.

`ProtectedViewportScrollView.requestChildRectangleOnScreen()`:

1. accepts the first request of the IME session;
2. converts the rectangle into container coordinates;
3. compensates for top controls shown for the editable;
4. brings coordinates that already include Chromium's content offset back
   inside `mContent`;
5. retains the neutral space originally present below the target;
6. applies the pan after Android has delivered the new view size.

Later requests are acknowledged without replacing the target. A site cannot
repeatedly reposition the physical viewport during the same IME session. The
target is cleared when the keyboard closes, the document changes, or
protection is disabled.

The minimum pan brings the target's bottom edge into the visible area. When
neutral space exists below the input, the patch also attempts to preserve it
above the keyboard. The physically hidden portion of the bottom controls is
subtracted from that space, avoiding a visual tail that does not belong to the
page.

## Browser controls

Opening the keyboard can show the top controls, hide the bottom controls, and
change the insets sent to the renderer. Without protection, those transitions
would expose IME geometry through Blink again.

The patch captures a snapshot containing:

- full and minimum top- and bottom-controls heights;
- the inset used to size `WebContents`;
- the visible bottom-controls height;
- the viewport width for which the snapshot is valid;
- the inset tracking mode.

The snapshot can be captured synchronously before the IME animation when an
editable forces controls visibility. Callbacks before and after layout keep
the geometry exposed to Blink separate from the physically visible geometry.

`ActivityTabWebContentsDelegateAndroid` returns protected controls dimensions
during the transition. `CompositorViewHolder.updateWebContentsSize()` also
uses the protected inset when calculating the `WebContents` size.

The patch requires `BrowserControlsEarlyResize`. Cromite enables it in both
the C++ default and the Java safe default, and asserts the invariant when the
controls are about to be shown.

When a browser-controls transition changes editable geometry without changing
focus, `WebContents.updateFocusedElementBounds()` crosses JNI and Mojo to
`WebFrameWidgetImpl`. The renderer sends the focus geometry again, allowing
`ImeAdapterImpl` to refresh its target without simulating a new focus event.

## Scrolling and cc handoff

Native pan must not terminate normal page scrolling. A vertical gesture may
cross:

1. the physical range of `ProtectedViewportScrollView`;
2. an inner page scroller;
3. the root viewport managed by cc;
4. the physical range again when cc has no more content to consume.

### Android to cc

When the `ScrollView` reaches one of its limits, `overScrollBy()` separates
the consumed delta from the remaining delta. The remainder is sent through
`CompositorScrollDelegate` and `EventForwarder` as a compositor
`begin/update/end` sequence.

The sequence:

- uses the real gesture location for normal cc hit testing;
- does not force the root viewport;
- does not create a new DOM touch-event sequence;
- may end with a fling when the finger leaves the boundary with sufficient
  velocity.

Axis selection is latched after touch slop. Horizontal gestures are not
consumed by the protected viewport; they remain available to Chromium
content and parent gesture handlers.

### cc to Android

An inner scroller may return `unused_scroll_delta` without setting
`did_overscroll_root`. Here, a *protected-viewport-generated sequence* means a
gesture sequence injected programmatically through `EventForwarder`, rather
than one originating from Android pointer dispatch. It is deliberately sent
with Chromium's `synthetic_scroll` field set to `false`, so it is not a Blink
synthetic-scroll event. `InputHandlerProxy` recognizes this sequence from
`target_viewport == false` and `pointer_count == 0`, then forwards the unused
delta and maintains its accumulated value.

`OverscrollControllerAndroid` recognizes a candidate sequence but does not
call Java reentrantly during `GestureScrollBegin`. The first overscroll
notification asks the Java view whether physical range remains available. If
Java accepts:

```text
InputHandlerProxy
  → OverscrollControllerAndroid
  → OverscrollRefresh
  → OverscrollRefreshHandler
  → SwipeRefreshHandler
  → ProtectedViewportScrollView
```

`SwipeRefreshHandler` locates the protected viewport by walking up from the
tab's `ContentView`. The cumulative value received from cc is applied relative
to the physical origin retained when the handoff began.

The path reuses the overscroll-refresh bridge, but it does not trigger pull to
refresh and does not transfer touch ownership back from Viz. A replacement
scroll begin, scroll end, fling, or `OverscrollControllerAndroid::Disable()`
explicitly ends the handoff.

## Internal state

`ProtectedViewportScrollView` separates state by responsibility:

| State | Responsibility |
| --- | --- |
| `BrowserControlsProtectionState` | Browser-controls snapshot, baselines, and latches |
| `ViewportPanState` | Requested rectangle, clearance, and unlocked physical range |
| `CompositorHandoffState` | Open synthetic protocol, forwarded delta, and pull origin |
| `GestureRoutingState` | Horizontal, vertical, and parent-deferred routing |
| IME flags | Running animation and closing direction |

These states have different lifecycles. Resetting a document is not the same
as ending a compositor gesture; similarly, enabling or disabling policy is not
equivalent to receiving the end of an IME animation.

## Diagnostics

`ProtectedViewportScrollView` contains diagnostics disabled by
`DEBUG_DIAGNOSTICS`. They cover:

- browser-controls snapshots and transitions;
- IME animation;
- pan requests and calculations;
- axis selection;
- handoff between the `ScrollView` and cc.

In assert-enabled builds, the protected viewport has a magenta background.
Visible magenta pixels indicate exposure of the native container rather than
Chromium content or browser UI.

Geometry logs in `ImeAdapterImpl` use the existing `DEBUG_LOGS` switch. They
must not be enabled normally. Global logs temporarily added to
`GestureEventStreamValidator`, `InputHandlerProxy`, and
`OverscrollControllerAndroid` were investigation tools and are not part of
the final implementation.

## Limitations and non-goals

### Keyboard presence

The patch hides geometry, not every possible bit related to IME presence.
Focus, input, and keyboard events are required for page functionality.
Keyboard-layout normalization belongs to other Cromite protections.

### Fixed and sticky elements

The current physical pan moves Chromium's entire Android output. A CSS
`position: fixed` element therefore moves with the rest of the surface during
physical pan instead of remaining attached to the logical viewport.

A complete solution requires a protected cc offset that remains distinct from
logical scroll and is applied through the property trees. The problem,
including sticky positioning, clamping, and hit testing, is described in
[PIXEL_PERFECT.md](PIXEL_PERFECT.md).

### Internal pages

WebUI and extension pages are explicitly excluded by both the Java and Blink
policy checks. They retain Chromium's standard virtual-keyboard behavior and
are outside the protection and its testing contract.

### Live content-setting changes

Changing the geometry model in the middle of a document is not an objective.
A reload is required after changing the content setting.

## Verification

Chromium's automated test targets are not yet available in the Cromite build;
the patch has primarily been validated with the Android emulator and
BrowserStack campaigns. Automated coverage for the main lifecycles must be
added before final stabilization.

The minimum manual verification matrix should include:

1. keyboard closed → open → closed without losing focus;
2. browser controls visible and hidden when the IME opens;
3. configurations with and without bottom controls;
4. normal input, nested editable, and an editor with an inner scroller;
5. scroll and fling in both directions;
6. horizontal gestures;
7. closing the keyboard without blur;
8. switching tabs between sites with different policy;
9. reload, navigation, and history restoration;
10. rotation and system-inset changes;
11. Android gesture navigation and three-button navigation;
12. global feature and content setting disabled.

For each keyboard state, the JavaScript probe should collect at least:

```text
window.innerWidth / innerHeight / outerWidth / outerHeight
documentElement.clientWidth / clientHeight
visualViewport dimensions, offsets, and scale
screen and devicePixelRatio
100vh / 100dvh / 100svh / 100lvh
navigator.virtualKeyboard.overlaysContent
navigator.virtualKeyboard.boundingRect
env(keyboard-inset-top/right/bottom/left/width/height)
```

With protection enabled, opening and closing the IME must not produce
persistent geometry attributable to its size. The focused content must remain
reachable and scrolling must continue without jumps, accidental long-touch
menus, or invalid gesture sequences.

## Rebase-sensitive areas

The following areas require manual review after each Chromium update:

- construction and ownership of `CompositorView` and `ContentView` in
  `CompositorViewHolder`;
- `keyboardInset`, controls-inset, and `WebContents` size calculation;
- `VirtualKeyboardMode` policy and lifecycle;
- top- and bottom-browser-controls callbacks;
- focus geometry and `CursorAnchorInfo` in `ImeAdapterImpl`;
- the `FrameWidgetInputHandler` and `WebFrameWidgetImpl` protocol;
- synthetic gesture creation in `EventForwarder`;
- `unused_scroll_delta` handling in `InputHandlerProxy`;
- overscroll state in `OverscrollControllerAndroid`;
- the `OverscrollRefreshHandler` bridge and `SwipeRefreshHandler` integration;
- renderer content-setting application in `Page` and `ViewportData`;
- Virtual Keyboard API notification in `LocalFrameMojoHandler`.
