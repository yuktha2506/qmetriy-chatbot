import PropTypes from 'prop-types'; 

const HyperLink = ({ url, children, style}) => {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"style={style}>
      {children}
    </a>
  );
};

HyperLink.propTypes = {
  url: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
};

export default HyperLink;
