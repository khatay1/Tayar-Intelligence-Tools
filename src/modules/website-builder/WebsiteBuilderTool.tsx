import { useWebsiteBuilderController, type WebsiteBuilderToolProps } from './core/use-website-builder-controller';
import { WebsiteBuilderPresentation } from './v2-ui/WebsiteBuilderPresentation';

export default function WebsiteBuilderTool(props: WebsiteBuilderToolProps) {
  const view = useWebsiteBuilderController(props);
  return <WebsiteBuilderPresentation {...view} />;
}
