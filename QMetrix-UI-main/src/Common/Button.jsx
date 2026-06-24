import PropTypes from 'prop-types';
import classNames from 'classnames';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  className,
  ...props
}) => {
  const baseClasses =
    'focus:ring-2 focus:outline-none font-medium rounded-md text-sm px-2 py-2.5 text-center';
  const transparentBaseClasses =
    'focus:outline-none font-medium rounded-md text-sm px-2 py-2.5 text-center';

  const variantClasses = {
    primary:
      'text-white bg-blue-800 hover:bg-blue-800 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800',
    secondary:
      'text-gray-900 bg-white border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700',
    transparent:
      "text-black dark:text-white  font-medium rounded-sm text-sm px-1 py-1 text-center inline-flex items-center  bg-[#151F2C] border border-[#25384F] hover:border-[#326AEB66] focus:border-[#326AEB] focus:shadow-[0_0_6px_0_rgba(50,106,235,0.8)] transition-all duration-200"
  };
  const getBaseClasses = () => {
    return variant === 'transparent' ? transparentBaseClasses : baseClasses;
  }
  return (
    <button
      type={type}
      onClick={onClick}
      className={classNames(getBaseClasses(), variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary']),
  className: PropTypes.string,
};

export default Button;
