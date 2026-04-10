import React, { useCallback, useEffect, useId, useRef, useState } from "react";

export interface TooltipProps {
	content: string;
	children: React.ReactElement;
	side?: "top" | "bottom" | "left" | "right";
	delay?: number;
}

interface TooltipPosition {
	top: number;
	left: number;
}

function computePosition(
	rect: DOMRect,
	tooltipEl: HTMLElement,
	side: "top" | "bottom" | "left" | "right",
): TooltipPosition {
	const { width: tw, height: th } = tooltipEl.getBoundingClientRect();
	const gap = 6;

	switch (side) {
		case "bottom":
			return {
				top: rect.bottom + gap,
				left: rect.left + rect.width / 2 - tw / 2,
			};
		case "left":
			return {
				top: rect.top + rect.height / 2 - th / 2,
				left: rect.left - tw - gap,
			};
		case "right":
			return {
				top: rect.top + rect.height / 2 - th / 2,
				left: rect.right + gap,
			};
		case "top":
		default:
			return {
				top: rect.top - th - gap,
				left: rect.left + rect.width / 2 - tw / 2,
			};
	}
}

export function Tooltip({ content, children, side = "top", delay = 400 }: TooltipProps) {
	const tooltipId = useId();
	const [visible, setVisible] = useState(false);
	const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

	const triggerRef = useRef<HTMLElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const show = useCallback(() => {
		clearTimer();
		timeoutRef.current = setTimeout(() => {
			setVisible(true);
		}, delay);
	}, [clearTimer, delay]);

	const hide = useCallback(() => {
		clearTimer();
		setVisible(false);
	}, [clearTimer]);

	// Reposition after the tooltip becomes visible and is in the DOM.
	useEffect(() => {
		if (!visible) return;
		if (!triggerRef.current || !tooltipRef.current) return;

		const rect = triggerRef.current.getBoundingClientRect();
		setPosition(computePosition(rect, tooltipRef.current, side));
	}, [visible, side]);

	// Dismiss on Escape key.
	useEffect(() => {
		if (!visible) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") hide();
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [visible, hide]);

	// Clear timeout on unmount.
	useEffect(() => clearTimer, [clearTimer]);

	// Resolve the child's existing ref so we can forward it.
	const childRef = (children as React.ReactElement & { ref?: React.Ref<unknown> }).ref;

	const mergedRef = useCallback(
		(node: HTMLElement | null) => {
			(triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;

			if (typeof childRef === "function") {
				childRef(node);
			} else if (childRef && typeof childRef === "object") {
				(childRef as React.MutableRefObject<HTMLElement | null>).current = node;
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[childRef],
	);

	const clonedChild = React.cloneElement(children, {
		ref: mergedRef,
		"aria-describedby": visible ? tooltipId : undefined,
		onMouseEnter: (e: React.MouseEvent) => {
			show();
			children.props.onMouseEnter?.(e);
		},
		onMouseLeave: (e: React.MouseEvent) => {
			hide();
			children.props.onMouseLeave?.(e);
		},
		onFocus: (e: React.FocusEvent) => {
			show();
			children.props.onFocus?.(e);
		},
		onBlur: (e: React.FocusEvent) => {
			hide();
			children.props.onBlur?.(e);
		},
	});

	return (
		<>
			{clonedChild}
			{visible && (
				<div
					id={tooltipId}
					ref={tooltipRef}
					role="tooltip"
					style={{
						position: "fixed",
						top: position.top,
						left: position.left,
						background: "var(--fp-surface-3)",
						border: "1px solid var(--fp-border-2)",
						borderRadius: 6,
						padding: "5px 8px",
						fontSize: 11,
						color: "var(--fp-text-2)",
						boxShadow: "var(--fp-shadow-md)",
						zIndex: 60,
						pointerEvents: "none",
						whiteSpace: "nowrap",
						animation: "fp-tooltip-in 100ms ease",
					}}
				>
					{content}
				</div>
			)}
		</>
	);
}
