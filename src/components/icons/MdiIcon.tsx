import { Icon } from "@mdi/react";

type MdiIconProps = {
  path: string;
  size?: number;
};

export function MdiIcon({ path, size = 0.75 }: MdiIconProps) {
  return <Icon path={path} size={size} aria-hidden="true" />;
}
