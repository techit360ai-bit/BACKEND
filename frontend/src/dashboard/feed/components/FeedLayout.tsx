import { Outlet } from "react-router-dom";
import { Layout } from "./Layout";

export function FeedLayout() {
  return (
    <div className="feed-scope">
      <Layout>
        <Outlet />
      </Layout>
    </div>
  );
}
