export const setNotificationContext = (userType) => (req, _res, next) => {
  const idMap = {
    Admin: req.admin?._id,
    StoreEmployee: req.storeEmployee?._id,
  };

  req.userId   = idMap[userType];
  req.userType = userType;
  next();
};
