import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
// Middleware to check if the user is signed in based on that dashboard or account or transaction and other pages are to be shown or not
const isProtectedRoute = createRouteMatcher([
    '/dashboard(.*)',
    '/account(.*)',
    '/transactions(.*)',
])


export default clerkMiddleware( async (auth, req) => {
  // Check if the user is signed in
  const { userId } = await auth();

  // If the user is not signed in and trying to access a protected route, redirect to sign-in page
    if (!userId && isProtectedRoute(req)) {
        const { redirectToSignIn } = await auth();
        return redirectToSignIn();
    }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};