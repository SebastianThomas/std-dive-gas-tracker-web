<template>
  <main class="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Page not found</h1>
    <RouterLink :to="{ name: 'Start' }" class="text-sky-600 hover:underline dark:text-sky-400">
      Back to the start page
    </RouterLink>
  </main>
</template>
