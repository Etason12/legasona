export const isAdmin = (user) => user?.role?.toLowerCase() === 'admin'

export const canAdminCrud = isAdmin
