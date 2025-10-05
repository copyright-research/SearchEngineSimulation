"use client";

import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  (props: ResponseProps) => (
    <Streamdown
      parseIncompleteMarkdown={true}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
